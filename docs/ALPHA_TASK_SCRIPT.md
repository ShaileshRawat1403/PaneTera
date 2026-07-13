# Alpha Task Script: Step-by-Step User Journey

This script walks you through a 15–20 minute testing session to evaluate MyAI Portal v0.1.0's layout, sandboxing, and navigation features.

---

## Task List

### 1. Open the Portal & Confirm Sandbox State
* **Action**: Launch the app and open `http://localhost:5173`.
* **Verification**: Verify that the top banner shows `GOVERNED READ-ONLY SANDBOX MODE` and `GATEWAY: ONLINE`. Verify that the bottom rail shows the status `Sandboxed`.
* **Note**: The Live App Workbench is experimental and not part of the main test session. The default provider is 'none', meaning the central chat returns concise, deterministic summaries from local tool executions.

### 2. Set Up Tester Info
* **Action**: Click the purple **"User Testing Cockpit"** button in the bottom left rail.
* **Verification**: Enter your tester name (e.g. `Alpha Tester 01`) and checklist tasks will load. Keep this cockpit open or drawer accessible.

### 3. Select and Enable a Workspace
* **Action**: In the left rail catalog list, click the toggle switch for **"Soothsayer Core Workspace"** (or a mock repository from the setup guide).
* **Verification**: Verify that the status indicator glows green (`ONLINE`), and select the workspace card to load the file tree.

### 4. Inspect the Workspace Overview & Tech Stack
* **Action**: Look at the main feed panel.
* **Verification**: Confirm the dashboard card lists detected package technologies (e.g. React SPA, Vite) with appropriate confidence badges.

### 5. Inspect a Safe Source File
* **Action**: Navigate the file tree on the left and select `README.md` or a source file.
* **Verification**: Verify the code loads cleanly in the preview panel with line numbers. Click **"Wrap"** and **"Unwrap"** to test line wrapping readability.
* **Note**: The preview panel is read-only. It displays a "Read-only preview" lock badge indicating it cannot edit files.

### 6. Run Static Structure Scan
* **Action**: Select a `.ts`, `.tsx`, or `.py` file from the explorer tree.
* **Verification**: Observe that the `Static Structure Scan` card automatically updates to display imported packages, exports, functions, and classes. Scroll through the symbol list.

### 7. Map Dependency Routes
* **Action**: Click the **"Map Dependency Routes"** button beneath the symbol card.
* **Verification**: Wait for the loader (`Mapping dependencies...`) to resolve. Check that duplicates clicks are blocked while loading. Confirm the dependency routing tree renders.
* **Note**: You can toggle "Show local files only" to filter out external libraries (like React or MUI packages) from the dependency tree view.

### 8. Navigate Interactively
* **Action**: Locate a resolved module in the dependency node list, and **click it**.
* **Verification**: Verify that the file tree automatically selects that file, the preview panel loads its code, and the symbol scan updates. Confirm that clicking an external package or path alias displays a detailed warning SnackBar instead of attempting to open.

### 9. Execute Simulated Safety Check
* **Action**: Click the red **"Security boundary demo"** button in the quick action deck.
* **Verification**: Confirm that the confirmation modal says exactly:
  > *"This is a simulated safety check. The portal will request a forbidden file to verify that the Host Policy Engine blocks unauthorized reads. No file contents will be exposed. A denied event will be added to the audit log."*
* Click **"Run safety check"** and verify that access is blocked and the warning banner is shown.

### 10. Inspect Audit Logs
* **Action**: Click the **"View Audit Logs"** button next to the top global banner.
* **Verification**: Inspect the log entries. Locate the green `allowed` entry for the safe readme file, and find the red `denied` entry for the security demo file.

### 11. Save and Export Feedback
* **Action**: Re-open the testing cockpit drawer. Grade your session friction score (1 to 5), write any notes in the text box, and click **"Export Local Session Summary"**.
* **Verification**: Verify that the browser triggers a client-side download of a JSON session feedback file.
