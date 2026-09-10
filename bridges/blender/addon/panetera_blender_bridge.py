# bridges/blender/addon/panetera_blender_bridge.py
#
# PaneTera Live Bridge for Blender 5.2 LTS / 4.5 LTS
#
# How to run:
#   1. In Blender, switch to the "Scripting" tab at the top.
#   2. Click "Open" and select this file (or paste its contents and click "Run Script").
#   3. The bridge will start listening on localhost:9871 and safely queue commands
#      to Blender's main thread via bpy.app.timers.

import bpy
import sys
import json
import socket
import threading
import hashlib
from queue import Queue

HOST = '127.0.0.1'
PORT = 9871

work_queue = Queue()
response_map = {}
server_socket = None
is_running = True

def compute_object_digest(obj):
    try:
        mods = [{"name": m.name, "type": m.type} for m in obj.modifiers]
        mats = [{"name": s.material.name} for s in obj.material_slots if s.material]
        data = {
            "name": obj.name,
            "type": obj.type,
            "location": [round(v, 4) for v in obj.location],
            "rotation": [round(v, 4) for v in obj.rotation_euler],
            "scale": [round(v, 4) for v in obj.scale],
            "modifiers": mods,
            "materials": mats,
        }
        serialized = json.dumps(data, sort_keys=True)
        return "sha256:" + hashlib.sha256(serialized.encode('utf-8')).hexdigest()
    except Exception:
        return "sha256:unknown"

def process_command(cmd):
    action = cmd.get("action")
    params = cmd.get("params", {})
    req_id = cmd.get("id")

    res = {"id": req_id, "success": False}

    try:
        if action == "status" or action == "handshake":
            res["success"] = True
            res["data"] = {
                "blenderVersion": f"{bpy.app.version[0]}.{bpy.app.version[1]}.{bpy.app.version[2]}",
                "blenderFileVersion": bpy.app.version_file,
                "pythonVersion": sys.version.split()[0],
                "activeEngine": bpy.context.scene.render.engine if bpy.context.scene else "CYCLES",
                "activeFile": bpy.data.filepath or "Untitled",
            }

        elif action == "blender.get_scene_summary":
            collections = []
            for col in bpy.data.collections:
                collections.append({
                    "name": col.name,
                    "objectIds": [o.name for o in col.objects]
                })

            objects = []
            for obj in bpy.data.objects:
                mesh_data = obj.data if obj.type == 'MESH' and obj.data else None
                vert_count = len(mesh_data.vertices) if mesh_data else 0
                face_count = len(mesh_data.polygons) if mesh_data else 0

                mods = []
                for m in obj.modifiers:
                    mod_dict = {"name": m.name, "type": m.type, "parameters": {}}
                    if m.type == 'BEVEL':
                        mod_dict["parameters"] = {
                            "width": getattr(m, 'width', 0.05),
                            "segments": getattr(m, 'segments', 1),
                        }
                    elif m.type == 'SUBSURF':
                        mod_dict["parameters"] = {
                            "levels": getattr(m, 'levels', 1),
                            "render_levels": getattr(m, 'render_levels', 2),
                        }
                    mods.append(mod_dict)

                mats = []
                for s in obj.material_slots:
                    if s.material:
                        mats.append({"name": s.material.name, "nodeType": "PrincipledBSDF"})

                objects.append({
                    "id": obj.name,
                    "name": obj.name,
                    "type": obj.type,
                    "location": [obj.location.x, obj.location.y, obj.location.z],
                    "rotation": [obj.rotation_euler.x, obj.rotation_euler.y, obj.rotation_euler.z],
                    "scale": [obj.scale.x, obj.scale.y, obj.scale.z],
                    "vertexCount": vert_count,
                    "faceCount": face_count,
                    "modifiers": mods,
                    "materials": mats,
                    "selected": obj.select_get() if hasattr(obj, 'select_get') else False,
                    "stateDigest": compute_object_digest(obj),
                })

                active_cam = bpy.context.scene.camera.name if bpy.context.scene.camera else None

            res["success"] = True
            res["data"] = {
                "runtime": {
                    "blenderVersion": f"{bpy.app.version[0]}.{bpy.app.version[1]}.{bpy.app.version[2]}",
                    "pythonVersion": sys.version.split()[0],
                    "activeEngine": bpy.context.scene.render.engine,
                    "isConnected": True,
                },
                "fileName": (bpy.data.filepath.split('/')[-1] or "Untitled.blend") if bpy.data.filepath else "Untitled.blend",
                "filePath": bpy.data.filepath or "/Untitled.blend",
                "collections": collections,
                "objects": objects,
                "selectedObjectId": bpy.context.active_object.name if bpy.context.active_object else (objects[0]["id"] if objects else None),
                "activeCamera": active_cam,
            }

        elif action == "blender.add_modifier":
            obj_id = params.get("objectId")
            mod_type = params.get("modifierType", "BEVEL")
            mod_name = params.get("name", mod_type.capitalize())
            mod_params = params.get("parameters", {})

            obj = bpy.data.objects.get(obj_id)
            if not obj:
                res["error"] = f"Object '{obj_id}' not found"
            else:
                mod = obj.modifiers.new(name=mod_name, type=mod_type)
                if mod_type == 'BEVEL':
                    if "width" in mod_params:
                        mod.width = float(mod_params["width"])
                    if "segments" in mod_params:
                        mod.segments = int(mod_params["segments"])
                elif mod_type == 'SUBSURF':
                    if "levels" in mod_params:
                        mod.levels = int(mod_params["levels"])

                res["success"] = True
                res["data"] = {
                    "objectId": obj.name,
                    "modifierName": mod.name,
                    "newDigest": compute_object_digest(obj),
                }

        elif action == "blender.create_primitive":
            prim_type = params.get("type", "CUBE")
            name = params.get("name")
            loc = params.get("location", [0, 0, 0])

            if prim_type == 'CUBE':
                bpy.ops.mesh.primitive_cube_add(location=loc)
            elif prim_type == 'CYLINDER':
                bpy.ops.mesh.primitive_cylinder_add(location=loc)
            elif prim_type == 'SPHERE':
                bpy.ops.mesh.primitive_uv_sphere_add(location=loc)
            elif prim_type == 'PLANE':
                bpy.ops.mesh.primitive_plane_add(location=loc)
            elif prim_type == 'TORUS':
                bpy.ops.mesh.primitive_torus_add(location=loc)

            new_obj = bpy.context.active_object
            if name and new_obj:
                new_obj.name = name

            res["success"] = True
            res["data"] = {
                "objectId": new_obj.name if new_obj else "unknown",
                "digest": compute_object_digest(new_obj) if new_obj else None,
            }

        else:
            res["error"] = f"Unknown action '{action}'"

    except Exception as e:
        res["error"] = str(e)

    return res

def main_thread_timer():
    """Executed on Blender's main UI thread via bpy.app.timers."""
    while not work_queue.empty():
        req_id, cmd = work_queue.get_nowait()
        result = process_command(cmd)
        response_map[req_id] = result
    return 0.05  # Run every 50ms

def handle_client(conn):
    try:
        buffer = ""
        while is_running:
            data = conn.recv(4096)
            if not data:
                break
            buffer += data.decode('utf-8')
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                cmd = json.loads(line)
                req_id = cmd.get("id", "req-0")

                work_queue.put((req_id, cmd))

                # Wait for main thread to process
                import time
                start = time.time()
                while req_id not in response_map and time.time() - start < 5.0:
                    time.sleep(0.01)

                resp = response_map.pop(req_id, {"id": req_id, "success": False, "error": "Timeout waiting for Blender main thread"})
                conn.sendall((json.dumps(resp) + "\n").encode('utf-8'))
    except Exception as e:
        print(f"[PaneTera Bridge] Client connection error: {e}")
    finally:
        conn.close()

def server_thread_func():
    global server_socket
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server_socket.bind((HOST, PORT))
        server_socket.listen(5)
        print(f"==================================================")
        print(f"✓ PaneTera Blender Bridge ACTIVE on {HOST}:{PORT}")
        print(f"==================================================")
        while is_running:
            try:
                conn, _ = server_socket.accept()
                t = threading.Thread(target=handle_client, args=(conn,), daemon=True)
                t.start()
            except Exception:
                break
    except Exception as e:
        print(f"[PaneTera Bridge] Server bind error: {e}")

# Register timer and start server thread
if not bpy.app.timers.is_registered(main_thread_timer):
    bpy.app.timers.register(main_thread_timer, persistent=True)

server_thread = threading.Thread(target=server_thread_func, daemon=True)
server_thread.start()
