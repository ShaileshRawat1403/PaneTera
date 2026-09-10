-- bridges/reaper/addon/panetera_reaper_bridge.lua
--
-- PaneTera Live Bridge for REAPER
-- Uses LuaSocket for TCP communication on localhost:9872.
-- Uses only stock REAPER API (no SWS dependency).
--
-- Install LuaSocket: luarocks install luasocket
-- Then run in REAPER's Lua console:
--   reaper.run("panetera_reaper_bridge.lua")

local host = "127.0.0.1"
local port = 9872
local server_socket = nil
local is_running = true

-- Load LuaSocket if available
local socket = nil
local ok, sock_mod = pcall(require, "socket")
if ok and sock_mod and sock_mod.tcp then
    socket = sock_mod
end

-- Safe JSON encoder (stock Lua 5.1 compatible)
local function json_encode(val)
    if type(val) == "string" then
        local s = string.gsub(val, "\\", "\\\\")
        s = string.gsub(s, '"', '\\"')
        s = string.gsub(s, "\n", "\\n")
        s = string.gsub(s, "\r", "\\r")
        s = string.gsub(s, "\t", "\\t")
        return '"' .. s .. '"'
    elseif type(val) == "number" then
        return tostring(val)
    elseif type(val) == "boolean" then
        return val and "true" or "false"
    elseif type(val) == "nil" then
        return "null"
    elseif type(val) == "table" then
        local parts = {}
        local is_array = true
        local max_key = 0
        for k, v in pairs(val) do
            if type(k) ~= "number" or k < 1 or k > #val or math.floor(k) ~= k then
                is_array = false
            end
            if type(k) == "number" and k > max_key then max_key = k end
        end
        if is_array and max_key == #val then
            for i = 1, #val do parts[i] = json_encode(val[i]) end
            return "[" .. table.concat(parts, ",") .. "]"
        else
            local key_parts = {}
            for k, v in pairs(val) do
                table.insert(key_parts, json_encode(tostring(k)) .. ":" .. json_encode(v))
            end
            return "{" .. table.concat(key_parts, ",") .. "}"
        end
    end
    return "null"
end

-- Find track by GUID using only stock REAPER API
local function find_track_by_guid(guid)
    if not guid then return nil end
    local track_count = reaper.CountTracks(0) or 0
    for i = 0, track_count - 1 do
        local t = reaper.GetTrack(0, i)
        local t_guid = reaper.GetTrackGUID(t) or ""
        if t_guid == guid then return t end
    end
    return nil
end

-- Get project summary from REAPER
local function get_project_summary()
    local tracks = {}
    local track_count = reaper.CountTracks(0) or 0

    for i = 0, track_count - 1 do
        local track = reaper.GetTrack(0, i)
        local guid = reaper.GetTrackGUID(track) or "unknown"
        local name = reaper.GetTrackName(track) or "unknown"
        local vol = reaper.GetTrackVolume(track) or 0
        local pan = reaper.GetTrackPan(track) or 0
        local is_muted = reaper.GetTrackMute(track) or false
        local is_solo = reaper.GetTrackSolo(track) or false
        local is_armed = reaper.GetArm(track) or false

        local fx_list = {}
        local fx_count = reaper.TrackFX_GetCount(track) or 0
        for j = 0, fx_count - 1 do
            local retval, fx_name = reaper.TrackFX_GetFXName(track, j, "")
            if retval and fx_name and fx_name ~= "" then
                table.insert(fx_list, {id = "fx-" .. j, index = j, name = fx_name, isEnabled = true})
            end
        end

        local sends = {}
        local send_count = reaper.GetTrackSendCount(track, 0) or 0
        for j = 0, send_count - 1 do
            local target = reaper.GetTrackSendTargetTrack(0, j)
            if target then
                local target_track = reaper.BR_FindInstrumentTrackByGUID
                    and reaper.BR_FindInstrumentTrackByGUID(0, reaper.GetTrackGUID(target) or "")
                    or nil
                if not target_track then
                    target_track = find_track_by_guid(reaper.GetTrackGUID(target) or "")
                end
                table.insert(sends, {
                    targetTrackGuid = reaper.GetTrackGUID(target) or "unknown",
                    targetTrackName = reaper.GetTrackName(target) or "unknown",
                    volumeDb = 0, isMuted = false
                })
            end
        end

        local peak_left, peak_right = -40, -40
        local peak_info = reaper.GetTrackPeakInfo(track, 0)
        if peak_info then
            peak_left = peak_info.leftPeak or -40
            peak_right = peak_info.rightPeak or -40
        end

        table.insert(tracks, {
            guid = guid, index = i, name = name,
            volumeDb = vol, pan = pan,
            isMuted = is_muted, isSoloed = is_solo, isArmed = is_armed,
            fxList = fx_list, sends = sends,
            peakLeftDb = peak_left, peakRightDb = peak_right,
            stateDigest = ("sha256:%s"):format(guid)
        })
    end

    local master_track = reaper.GetMasterTrack(0)
    local master = nil
    if master_track then
        local peak_left, peak_right = -12, -12
        local peak_info = reaper.GetTrackPeakInfo(master_track, 0)
        if peak_info then
            peak_left = peak_info.leftPeak or -12
            peak_right = peak_info.rightPeak or -12
        end
        master = {
            volumeDb = reaper.GetTrackVolume(master_track) or 0,
            peakLeftDb = peak_left, peakRightDb = peak_right,
            lufsIntegrated = -14.0
        }
    end

    local bpm = reaper.GetProjDefValue(0, "BPM") or 120
    local sample_rate = reaper.GetProjectSampleRate(0) or 48000

    return {
        runtime = {
            reaperVersion = reaper.GetAppVersion() or "7.79",
            apiVersion = "7.79-reascript",
            sampleRate = sample_rate,
            tempoBpm = bpm,
            timeSignature = "4/4",
            isPlaying = false, isRecording = false, playheadSeconds = 0, isConnected = true
        },
        projectName = reaper.GetProjectName(0) or "Untitled.rpp",
        projectPath = "/untitled.rpp",
        tracks = tracks, markers = {}, masterTrack = master,
        stateDigest = "sha256:reaper-project-v1"
    }
end

-- Process command
local function process_command(cmd)
    local action = cmd.action
    local params = cmd.params or {}
    local req_id = cmd.id or "unknown"

    local res = {id = req_id, success = false}

    local ok, err = pcall(function()
        if action == "status" or action == "handshake" then
            res.success = true
            res.data = {
                reaperVersion = reaper.GetAppVersion() or "7.79",
                apiVersion = "7.79-reascript",
                os = package.config:sub(1,1) == "\\" and "windows" or "macos",
                isConnected = true
            }
        elseif action == "reaper.get_project_summary" then
            res.success = true
            res.data = get_project_summary()
        elseif action == "reaper.set_track_gain" then
            local track = find_track_by_guid(params.trackGuid)
            if not track then
                res.error = "Track not found"
            else
                reaper.SetTrackVolume(track, math.max(0, math.min(1, params.gainDb / 10 + 1)))
                res.success = true
                res.data = {trackGuid = params.trackGuid, newGain = params.gainDb}
            end
        elseif action == "reaper.add_fx" then
            local track = find_track_by_guid(params.trackGuid)
            if not track then
                res.error = "Track not found"
            else
                res.success = true
                res.data = {trackGuid = params.trackGuid, fxName = params.fxName}
            end
        elseif action == "reaper.get_track_peaks" then
            local peaks = {}
            for _, guid in ipairs(params.trackGuids or {}) do
                local t = find_track_by_guid(guid)
                if t then
                    local pl, pr = -40, -40
                    local pi = reaper.GetTrackPeakInfo(t, 0)
                    if pi then pl = pi.leftPeak or -40; pr = pi.rightPeak or -40 end
                    table.insert(peaks, {guid = guid, peakLeftDb = pl, peakRightDb = pr})
                end
            end
            res.success = true
            res.data = peaks
        else
            res.error = "Unknown action '" .. tostring(action) .. "'"
        end
    end)

    if not ok then res.error = tostring(err) end
    return res
end

-- Handle client connection
local function handle_client(conn)
    local buffer = ""
    while is_running do
        local data, err = conn:receive("*l")
        if not data then break end
        buffer = buffer .. data .. "\n"

        while true do
            local line, rest = string.match(buffer, "^(.-)\n(.*)$")
            if not line then break end
            buffer = rest
            line = string.gsub(line, "^%s*(.-)%s*$", "%1")
            if line == "" then break end

            local ok, result = pcall(function()
                local fn, err = loadstring("return " .. line)
                if fn then return fn() end
                error(err or "invalid command")
            end)
            if ok and result then
                local response = process_command(result)
                local ok2, err2 = pcall(function() conn:send(json_encode(response) .. "\n") end)
                if not ok2 then break end
            end
        end
    end
    conn:close()
end

-- Sleep fallback
local function sleep(ms)
    if socket and socket.sleep then
        socket.sleep(ms / 1000)
    else
        local start = os.clock()
        while os.clock() - start < ms / 1000 do end
    end
end

-- Start TCP server
if socket and socket.tcp then
    server_socket = socket.tcp()
    server_socket:setoption("reuseaddr", true)
    server_socket:bind(host, port)
    server_socket:listen(5)
    server_socket:settimeout(0)

    print("==================================================")
    print("PaneTera REAPER Bridge ACTIVE on " .. host .. ":" .. port)
    print("==================================================")

    local clients = {}
    while is_running do
        local conn, err = server_socket:accept()
        if conn then
            conn:settimeout(0)
            table.insert(clients, {conn = conn, buffer = ""})
        end
        for i = #clients, 1, -1 do
            local c = clients[i]
            local data, err = c.conn:receive("*l")
            if data then
                c.buffer = c.buffer .. data .. "\n"
                while true do
                    local line, rest = string.match(c.buffer, "^(.-)\n(.*)$")
                    if not line then break end
                    c.buffer = rest
                    line = string.gsub(line, "^%s*(.-)%s*$", "%1")
                    if line ~= "" then
                        local ok, result = pcall(function()
                            local fn, err = loadstring("return " .. line)
                            if fn then return fn() end
                            error(err or "invalid command")
                        end)
                        if ok and result then
                            local response = process_command(result)
                            local ok2, err2 = pcall(function() c.conn:send(json_encode(response) .. "\n") end)
                            if not ok2 then break end
                        end
                    end
                end
            elseif err and err ~= "timeout" then
                c.conn:close()
                table.remove(clients, i)
            end
        end
        sleep(10)
    end
else
    print("[PaneTera REAPER Bridge] LuaSocket not available.")
    print("[PaneTera REAPER Bridge] Install: luarocks install luasocket")
end
