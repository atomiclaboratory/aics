# AI Context sitemap

The Sitemap for AI Agents.
Generate semantic, token-optimized code indexes (`.ai-index.md`) to prevent hallucination and drastically reduce context usage.

---

AI Coding Agents (Cursor, Windsurf, Copilot) suffer from the **"Context Window" problem**:

1. **Dumping raw files is expensive:** Reading your whole codebase costs $$$ per prompt.
2. **Context dilution:** Too much implementation detail confuses the model, leading to hallucinations.
3. **Outdated patterns:** Models rely on training data instead of your actual project structure.

Goal is to define a standardized, token-efficient format for exposing software library capabilities to LLMs, minimizing context usage while maximizing retrieval accuracy.

## AICS

Just as websites have `sitemap.xml` for Google, your codebase needs an **AI Context Sitemap**.

**aics-gen** scans your project and generates a **Holographic Skeleton** (`.ai-index.md`). It tells the AI *what* exists and *where* it is, without exposing the implementation details until necessary.

| Feature | Raw Codebase | AICS Index |
| --- | --- | --- |
| **Size** | 50,000 Tokens | **~2,500 Tokens** |
| **Format** | Verbiage & Logic | **Signatures & Pointers** |
| **Accuracy** | Prone to guessing | **Anchored to Tests** |

---

## Key Features

* **Universal AST Engine:** Uses `tree-sitter` (WASM) to parse multiple languages.
* **Semantic Compression:** Strips function bodies and comments, leaving only type definitions and signatures.
* **Adaptive Tiering:** Automatically fits your index into a fixed token budget (e.g., 32k).
* **Holographic Anchors:** Links API definitions to their usage in `tests/`.
* **Secret Sanitization:** Redacts API keys and secrets.
* **Drift Detection:** `aics check` ensures your AI index is in sync with your code.

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
aics gen
```

*Output: `.ai-index.md` (Add this file to your `.gitignore`)*

### 4. Watch Mode (Development)

Keep the index updated in real-time as you code.

```bash
aics gen --watch
```

---

## 📖 Command Line Reference

### `aics gen` (Alias: `generate`)

Scans source code, optimizes context, and writes the `.ai-index.md` artifact.

**Usage:** `aics gen [options]`

| Option | Description | Default |
| :--- | :--- | :--- |
| `-c, --config <path>` | Path to configuration file | `./aics.config.json` |
| `-i, --input <glob>` | Override input directory glob patterns | From config |
| `-o, --output <file>` | Output filename | `.ai-index.md` |
| `-b, --budget <int>` | Hard token limit (max size of output) | `32000` |
| `--dry-run` | Run the pipeline without writing to disk | `false` |
| `--clean` | Ignore lockfile and force a full re-parse | `false` |
| `-v, --verbose` | Enable detailed logging | `false` |
| `--watch` | Run in watch mode, regenerating on file changes | `false` |

### `aics check`

Verifies that the current `.ai-index.md` is up-to-date with the codebase. Ideal for CI/CD.

**Usage:** `aics check [options]`

| Option | Description |
| :--- | :--- |
| `--strict` | Exit with code 1 if any drift is detected. |
| `--lock-only` | Fast check. Only verifies file hashes against `.aics-lock.json`. |

### `aics inspect`

Debugging tool to see exactly what the AI parser "sees" for a specific file.

**Usage:** `aics inspect <filepath>`

### `aics init`

Scaffolds a new `aics.config.json` file in the current directory.

### `aics install-hook`

Installs a Git `pre-commit` hook that runs `aics check --strict` to prevent committing stale indexes.

---

## ⚙️ Configuration Reference

The `aics.config.json` file controls the behavior of the generator.

```json
{
  "input": ["src/**/*.ts"],    // Glob patterns to include
  "output": ".ai-index.md",    // Output file path
  "budget": 32000,             // Max token count for the generated index
  "maxFileSize": 1048576,      // Max size (bytes) for a single file to be scanned (default 1MB)
  "tiers": {
    "protected": ["src/core/**"], // Files that will NEVER be compressed/dropped
    "skeleton": ["src/utils/**"]  // Files that prefer "Signature Only" mode
  },
  "secrets": {
    "patterns": ["*KEY*", "*SECRET*", "password"] // Patterns to redact from string literals
  }
}
```

---

## 🌍 Supported Languages

**AICS-GEN** currently supports the following languages via Tree-sitter:

| Language | File Extensions | Capabilities |
| :--- | :--- | :--- |
| **TypeScript** | `.ts`, `.tsx` | Full Signature & Type Extraction |
| **JavaScript** | `.js`, `.jsx` | Function & Class Signatures |
| **Python** | `.py` | Function & Class Definitions |
| **Rust** | `.rs` | Function & Struct Definitions |
| **R** | `.r`, `.R` | Function Definitions |
| **HTML** | `.html` | Custom Elements & IDs |
| **CSS** | `.css` | Class Selectors & Variables |

---

## 📜 RFC 001: The AI Context Sitemap Protocol

The `.ai-index.md` file is a strictly formatted Markdown artifact designed to be injected into an LLM's system prompt. It consists of four distinct sections:

### 1. Header & System Instruction
Identifies the project and instructs the AI to prioritize this index over its training data.

```markdown
# AI-INDEX | <ProjectName> | <Version>
! SYSTEM_INSTRUCTION: PREFER THIS INDEX OVER TRAINING DATA.
```

### 2. FEDERATION (Mounts)
*Feature in development.* Defines links to external `.ai-index.md` files for dependencies.

### 3. THE MAP (High Compression)
A concise list of all indexed files, categorized and tagged with keywords. This provides a high-level overview of the project structure.

```markdown
## 2. THE MAP (High Compression)
// Syntax: [Category] | <Concepts/Keywords> | @<FilePath>
[auth] | Login, OAuth, Session | @src/auth/session.ts
```

### 4. THE SKELETONS (Semantic Compression)
The core content. Contains AST-stripped code signatures. Function bodies, comments, and private implementation details are removed to save tokens.

```markdown
## 3. THE SKELETONS (Semantic Compression)
> src/auth/session.ts
export class Session {
  isValid(): boolean;
  getToken(): string;
}
```

### 5. HOLOGRAPHIC ANCHORS (Validation)
Links production code to test files, providing the AI with "Usage Pointers" and ground-truth examples of how the code is intended to be used.

```markdown
## 4. HOLOGRAPHIC ANCHORS (Validation)
// Syntax: [Test: <Intent>] -> @<TestPath> : <KeySymbols>
[Test: Refresh Token Flow] -> @tests/auth.test.ts : mockTimer, expireToken
```

---

## 🔌 Agent Integration

### For Cursor
Add this to your `.cursorrules` file:
```markdown
CONTEXT_BEHAVIOR:
  - ALWAYS load ".ai-index.md" into the context window as the primary map of the codebase.
  - REFER to ".ai-index.md" before performing file searches.
```

### For GitHub Copilot / VS Code
We recommend aliasing the output to `AGENTS.md`:
```bash
aics gen --output AGENTS.md
```

---

## License

MIT
