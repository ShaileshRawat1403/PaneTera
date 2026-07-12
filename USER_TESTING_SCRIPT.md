# User Testing Script: V1 Alpha Walkthrough

This script provides testers with a step-by-step walkthrough to evaluate the MyAI Portal v0.1.0 Alpha checkpoint in under 3 minutes.

---

## Steps

### Step 1: Open the Portal and Check Status
1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Confirm the top header shows: `GOVERNED READ-ONLY SANDBOX MODE` and `GATEWAY: ONLINE`.

### Step 2: Set Up the User Testing Cockpit
1. Click the purple **"User Testing Cockpit"** button at the bottom of the left rail.
2. Enter your name (e.g. `"Alpha Tester A"`) in the text field.
3. Check task **"1. Open workspaces catalog"** off your checklist.

### Step 3: Enable the Soothsayer Workspace
1. In the left rail workspace catalog, click the activation switch for **"Soothsayer Core Workspace"**.
2. Once the indicator glows green (`ONLINE`), select the workspace card.
3. Check task **"2. Enable Soothsayer workspace"** off.

### Step 4: Verify Tech Stack Detection
1. Observe the **"Workspace Intelligence Dashboard"** card rendered at the top of the canvas.
2. Verify that **"React SPA (Vite)"** is listed with confidence **"DETECTED"**.
3. Check task **"3. Verify tech stack detection"** off.

### Step 5: Run Guided Actions
1. Click the **"Find TODOs"** button inside the "GUIDED WORKSPACE ACTIONS" deck.
2. Confirm that it searches files and outputs search matches.
3. Check task **"4. Run guided workspace actions"** off.

### Step 6: Inspect a Safe File
1. In the file explorer tree, click on `README.md`.
2. Confirm that the file is read and renders code with line numbers on the left.
3. Check task **"5. Open and inspect safe file"** off.

### Step 7: Test the Security Block (Demo)
1. Click the red **"Security boundary demo"** button in the actions deck.
2. Observe the warning confirmation dialog box that pops open.
3. Click **"Run safety check"**.
4. Confirm that the file is **NOT** loaded and the red access block warning is shown instead.
5. Check task **"6. Attempt blocked .env read"** off.

### Step 8: View System Audit Logs
1. Click **"Inspect System Audit Logs"** at the bottom of the left rail.
2. Confirm the log shows the blocked attempt in red (`file read denied`) and the safe readme read in green (`file read allowed`).
3. Close the audit window and check task **"7. Inspect append-only audit logs"** off.

### Step 9: Export Feedback Logs
1. Go back to the **Testing Cockpit** drawer.
2. Select a friction score (1 to 5) and write any notes.
3. Click **"Export Local Session Summary"**.
4. Confirm your browser downloads a `myai-portal-session-*.json` summary file.
