# Sample Workspace Setup Guide

To ensure a safe and controlled testing experience, we recommend using one of the following workspace structures during your session.

---

## 1. Recommended Testing Options

### Option A: Use Built-in Mock Repositories (Preferred)
The portal comes pre-packaged with sample mock configurations designed to showcase the platform:
* **Soothsayer Core Workspace**: A sample codebase representing a multi-component microservice stack.
* **Flowright Integrations Workspace**: A workspace containing various package dependencies and script setups.

### Option B: A Public Cloned Repository
Clone a small, public open-source project from GitHub to test dynamic file parsing:
```bash
git clone https://github.com/lodash/lodash.git
# Or any small project containing JavaScript, TypeScript, or Python files.
```

### Option C: Create a Throwaway Test Repository
Initialize a blank folder on your Desktop with some simple scripts:
```bash
mkdir my-test-project
cd my-test-project
echo "import os\ndef my_func():\n    print('Hello')" > test.py
```

---

## 2. Safety Warning

> [!WARNING]  
> **Do not connect sensitive or private production repositories** during this first alpha phase unless you fully understand the local read-only sandbox model. 
> While MyAI Portal is strictly read-only and runs offline, a sample or public throwaway repository is always preferred to ensure a clean evaluation loop.
