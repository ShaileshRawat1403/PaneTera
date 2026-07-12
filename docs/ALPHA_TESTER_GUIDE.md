# Alpha Tester Guide: MyAI Portal (v0.1.0)

Welcome to the MyAI Portal Alpha user testing session! This guide outlines what MyAI Portal is, how it protects your workspace context, and how to start and complete your test session.

---

## 1. What is MyAI Portal?
MyAI Portal is a local-first, single-window developer control plane designed to inspect and explore workspaces safely. It runs as an offline application on your local machine, bridging your local codebases with advanced AI intelligence via safe Model Context Protocol (MCP) servers.

### What it does:
* **Workspace Switches**: Scan, register, and inspect multiple code repositories dynamically.
* **Static Structure Scans**: Instantly discover imports, exports, functions, and classes inside source files without compiling or running files.
* **Static Dependency Mapping**: Trace relative path imports recursively to map code relationships.
* **Audit Logging**: Trace all read accesses, denied attempts, and policy configurations in a visual append-only log panel.

### What it does NOT do (Scope Lock):
* **No File Modifiers**: The portal is hardcoded to be strictly **read-only**. It cannot write, delete, or patch code files.
* **No Terminal Execution**: Command execution, scripts execution, and terminal panels are disabled.
* **No Browser Remote Control**: Web browsing control is completely locked down.
* **No Telemetry Leaves the Machine**: All data, feedback logs, and structure maps stay entirely on your local machine.

---

## 2. Getting Started

### Prerequisites:
* Node.js (v18+)
* A browser (Chrome recommended)

### Step 1: Start the Portal
Launch the development server in your terminal:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 2: Open the Testing Cockpit
Click the **"User Testing Cockpit"** button in the bottom left rail. Enter your tester name (e.g. `Alpha Tester A`) to initialize your session checklist.

---

## 3. What to Evaluate
We want you to focus on:
1. **Clarity**: Are labels, statuses, and disclaimers clear?
2. **Trust**: Does the sandbox banner and read-only warnings make you feel secure?
3. **Usability**: Is navigating files and clicking dependency mapping nodes intuitive?
4. **Audit Visibility**: Can you easily locate and understand the audit log timeline?
