# aics-gen

> **The Sitemap for AI Agents.**
> Generate semantic, token-optimized code indexes (`.ai-index.md`) to prevent hallucination and drastically reduce context usage.

---

## 🛑 The Problem

AI Coding Agents (Cursor, Windsurf, Copilot) suffer from the **"Context Window" problem**:

1. **Dumping raw files is expensive:** Reading your whole codebase costs $$$ per prompt.
2. **Context dilution:** Too much implementation detail confuses the model, leading to hallucinations.
3. **Outdated patterns:** Models rely on training data instead of your actual project structure.

Goal: To define a standardized, token-efficient format for exposing software library capabilities to LLMs, minimizing context usage while maximizing retrieval accuracy.

## ⚡ The Solution: AICS

Just as websites have `sitemap.xml` for Google, your codebase needs an **AI Context Sitemap**.

**aics-gen** scans your project and generates a **Holographic Skeleton** (`.ai-index.md`). It tells the AI *what* exists and *where* it is, without exposing the implementation details until necessary.

| Feature | Raw Codebase | AICS Index |
| --- | --- | --- |
| **Size** | 50,000 Tokens | **~2,500 Tokens** |
| **Format** | Verbiage & Logic | **Signatures & Pointers** |
| **Accuracy** | Prone to guessing | **Anchored to Tests** |

---

## ✨ Key Features

* **Universal AST Engine:** Uses `tree-sitter` (WASM) to parse TypeScript, JavaScript, Python, Rust, R, HTML, and CSS.
* **Semantic Compression:** Strips function bodies and comments, leaving only type definitions and signatures ("Pointer, Don't Explain").
* **Adaptive Tiering:** Automatically fits your index into a fixed token budget (e.g., 32k). Downgrades utility files to save space for core logic.
* **Holographic Anchors:** Automatically links API definitions to their usage in your `tests/` folder, giving the AI ground-truth examples.
* **Secret Sanitization:** Heuristic filters redact API keys and secrets from the index (`*KEY*`, `*TOKEN*`).
* **Drift Detection:** `aics check` ensures your AI index is never out of sync with your code in CI/CD.

---

## 🚀 Quick Start

### 1. Install

```bash
npm install -g @aics/cli

```

### 2. Initialize

Run this in your project root to create `aics.config.json`.

```bash
aics init

```

### 3. Generate the Index

```bash
aics generate

```

*Output: `.ai-index.md` (Add this file to your `.gitignore`)*

### 4. Watch Mode (Development)

Keep the index updated in real-time as you code.

```bash
aics gen --watch

```

---

## 🔌 Agent Integration

The AI doesn't know this file exists unless you tell it.

### For Cursor

Add this to your `.cursorrules` file:

```markdown
CONTEXT_BEHAVIOR:
  - ALWAYS load ".ai-index.md" into the context window as the primary map of the codebase.
  - REFER to ".ai-index.md" before performing file searches.

```

### For GitHub Copilot / VS Code

We recommend aliasing the output to `AGENTS.md`, which is becoming a standard convention.

```bash
aics gen --output AGENTS.md

```

---

## ⚙️ Configuration

Control the compression levels via `aics.config.json`:

```json
{
  "input": ["src", "lib"],
  "output": ".ai-index.md",
  "budget": 32000,
  "tiers": {
    "protected": ["src/core/**"],  // Always keep full signatures here
    "skeleton": ["src/utils/**"]   // Strip types if budget is tight
  },
  "secrets": {
    "patterns": ["*KEY*", "*SECRET*", "password"]
  }
}

```

---

## 🛠️ CI/CD Pipeline

Prevent "Context Drift" by failing the build if the index is stale.

**GitHub Actions Example:**

```yaml
name: AICS Check
on: [push, pull_request]

jobs:
  check-ai-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g @aics/cli
      - run: aics check --strict

```

---

## 📐 Architecture

**AICS-GEN** uses a 4-stage pipeline:

1. **Scan:** Walks the file system (respecting nested `.gitignore`s).
2. **Skeletonize:** Loads `web-tree-sitter` to parse code into ASTs, extracting only exported symbols.
3. **Tier Manager:** Calculates token costs. If `Total > Budget`, it iteratively "collapses" lower-priority files from **Full Skeletons** → **Signatures** → **File Maps**.
4. **Anchor:** Scans test files to find imports and usage intents, appending them as "Usage Pointers" to the index.

---

## 🤝 Contributing

We welcome contributions!

1. Clone the repo
2. Run `npm install`
3. Run `npm run setup` (Downloads WASM binaries)
4. Build with `npm run build`

## License

MIT © aTomic Lab