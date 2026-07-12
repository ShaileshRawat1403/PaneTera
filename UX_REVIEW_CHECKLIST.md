# UX Review Checklist: MyAI Portal V1

Use this checklist during local design reviews to verify that MyAI Portal meets the premium interface guidelines and read-only transparency expectations.

---

## 1. Visual Safety Indicator
* [ ] **Read-Only Banner**: Is the global `GOVERNED READ-ONLY SANDBOX MODE` banner visible at the top of the workspace?
* [ ] **Disabled Flags**: Does it prominently flag that write operations and shell commands are disabled?
* [ ] **Connection State**: Does it accurately show the local gateway status (ONLINE/OFFLINE)?

## 2. Navigation & Layout Hierarchy
* [ ] **Group Separation**: Is there a clear separation in the left rail between Connected Platforms, registered Workspaces, and the User Testing panel trigger?
* [ ] **Active Card**: Is it obvious which workspace is currently activated?
* [ ] **File Explorer Tree**: Does the navigation tree collapse and expand directories fluidly? Are size chips rendered on hover?

## 3. Code preview panel
* [ ] **Line Numbering**: Does the preview panel render line numbers on the left of each text line?
* [ ] **Size Tag**: Does the file header display the file size metric?
* [ ] **Blocked State**: When reading blocked files (like `.env`), is the "ACCESS BLOCKED BY HOST POLICY" warning clear, obvious, and not scary?

## 4. Security Audit trail
* [ ] **Logs Color Coding**: Are logs color-coded by status (Allowed = Green, Deny = Red, Info = Purple)?
* [ ] **Parameter Inspection**: Can you expand logs to inspect detailed JSON payload parameters?
