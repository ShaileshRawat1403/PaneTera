# Local LLM Summaries with Ollama

Tessera Workbench operates primarily in a local-first, zero-external-dependency mode. By default, it uses a **Deterministic Fallback Engine** to summarize repository code and dependencies.

If you want richer natural language explanations of files, imports, and architectures without sending data to external cloud APIs, you can optionally configure a local offline LLM using **Ollama**.

---

## 1. Setup Ollama Locally

1. **Download and Install**: Visit [ollama.com](https://ollama.com) and install the application for your operating system.
2. **Download a Model**: Open your terminal and pull a lightweight model suitable for your development machine:
   * **Phi-3 (3.8B)** (Recommended for limited hardware / 8GB RAM):
     ```bash
     ollama pull phi3
     ```
   * **Gemma-2 (2.6B)** (Great performance for lightweight tasks):
     ```bash
     ollama pull gemma2:2b
     ```
   * **Llama-3 (8B)** (Default standard, recommended for 16GB+ RAM):
     ```bash
     ollama pull llama3
     ```

---

## 2. Configure Environment Parameters

Inside the `.env` file at the root of `myai-portal`, append or modify the following properties:

```env
# Enable the local Ollama provider
ORCHESTRATOR_PROVIDER=ollama

# Point to your local Ollama instance (defaults to port 11434)
OLLAMA_HOST=http://127.0.0.1:11434
```

*Note: The orchestrator script inside `server/orchestrator.ts` defaults to querying the `llama3` model. If you pulled a different model, pull/tag it as `llama3` or update the model query parameter in the code.*

---

## 3. Privacy & Offline Guarantee

* **No External Requests**: All model inferences run completely on your local CPU/GPU. No code snippets or file details travel over the internet.
* **Inspected Snippets Notice**: When you ask a question, the local tool outputs (such as structure analysis or read files) are fed directly into the local model prompt context.

---

## 4. How to Disable & Fallback

To revert to the deterministic fallback parser at any time, simply edit your `.env`:

```env
ORCHESTRATOR_PROVIDER=none
```

Restart the dev server (`npm run dev`) after changing environment values to apply the updates.
