# Demo Script: 3-Minute Walkthrough (MyAI Portal V1)

Follow these steps to demonstrate the read-only safety model, host policies, and unified dashboard of **MyAI Portal v0.1.0**.

---

## 1. Preparation
Ensure the portal is running locally:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Authenticate using the secret rotated token set in your `.env`.

---

## 2. Walkthrough Steps

### Step 1: Open the Workspaces Catalog
* Observe the left rail sidebar panel. It shows a list of workspaces.
* By default, the pre-registered **Soothsayer Core Workspace** is shown as disabled and offline.
* Double-check: Click on the workspace in the list. The central canvas remains blank because the workspace is inactive.

### Step 2: Enable the Workspace
* Toggle the activation switch on the right side of the **Soothsayer Core Workspace** list item.
* Observe: The status indicator immediately changes to `ONLINE` (green), and the host backend spawns the stdio workspace adapter process.

### Step 3: Browse the Safe File Tree
* The central Canvas immediately loads the recursive workspace file structure.
* Observe that hidden files, build logs, and `node_modules` folders are filtered out by the scanner.
* Click on `SECURITY.md` in the explorer list.
* The file viewer reads and displays the text contents inside a clean, read-only code display block.

### Step 4: Test Security Blocking (Host Policy Wrap)
* Click or inspect the directory path `apps/api/` in the tree.
* Find or attempt to query `.env` files (e.g. `apps/api/.env`) using the API or by requesting it.
* **Result**: The UI instantly displays an **"ACCESS BLOCKED BY HOST POLICY"** red warning box:
  ```
  Access Denied: Reading of file 'apps/api/.env' is forbidden by host policy rules.
  ```

### Step 5: Test Directory Traversal Prevention
* Attempt to query traversal paths like `../myai-portal/server/index.ts`.
* **Result**: Rejects immediately. The warning overlay details that traversal paths going outside the workspace root are blocked.

### Step 6: Review the Append-Only Audit Trail
* Click the **"Inspect System Audit Logs"** button at the bottom of the Left Sidebar panel.
* A dialog pops open, fetching the latest logs from the host file.
* Observe the log timeline:
  - Allowed operations (`workspace.listFiles`, reading `SECURITY.md`) are logged in green.
  - Denied attempts (reading `.env`, path traversal) are flagged in red as `file read denied` with the exact policy violation reason.

---

## 3. Product Vision Summary
* This is not just a file browser. It is a **governed mission control shell**.
* The file tree and listings are computed inside an isolated MCP adapter subprocess.
* The host backend enforces authoritative check rules *before* queries touch the adapter.
* We have proved complete read-only safety.
