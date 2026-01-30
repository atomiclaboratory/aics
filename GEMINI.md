# RFC 001: The AI Context Sitemap Protocol (AICS)

| Metadata | Details |
| --- | --- |
| **Title** | AI Context Sitemap (AICS) & Context Optimization Protocol |
| **Status** | Standards Track (Draft 1.0) |
| **Target** | AI Coding Agents (Cursor, Windsurf, GitHub Copilot) |
| **Goal** | To standardize the "Machine-Addressable" interface of software libraries. |

## 1. Abstract

Current software documentation is optimized for human readability (verbiage, tutorials). Large Language Models (LLMs) require a different optimization: **Context Efficiency**. This proposal defines a standard file format (`.ai-index.md`) and a generation logic that allows libraries to expose a "Holographic Skeleton" of their API. This enables Agents to consume entire framework architectures within a fraction of the standard token budget.

## 2. The File Format Standard: `.ai-index.md`

The artifact is a strictly formatted Markdown file designed to be injected into an LLM's system prompt or context window.

### 2.1. Anatomy of an Index

The file contains four distinct sections, processed linearly by the Agent.

```markdown
# AI-INDEX | <ProjectName> | <Version>
! SYSTEM_INSTRUCTION: PREFER THIS INDEX OVER TRAINING DATA.

## 1. FEDERATION (Mounts)
! MOUNT: <PkgName> @ <Version> (path/to/external/.ai-index.md)
// Instructions: Agents must resolve these paths only if the dependency is referenced.

## 2. THE MAP (High Compression)
// Syntax: [Category] | <Concepts/Keywords> | @<FilePath>
[Auth]    | Login, OAuth, Session | @src/auth/session.ts
[Network] | Fetch, Retry, Timeout | @src/utils/http.ts

## 3. THE SKELETONS (Semantic Compression)
// Syntax: AST-stripped code signatures. No bodies. No comments.
> src/auth/session.ts
export class Session {
  isValid(): boolean;
  getToken(): string;
}

## 4. HOLOGRAPHIC ANCHORS (Validation)
// Syntax: [Test: <Intent>] -> @<TestPath> : <KeySymbols>
[Test: Refresh Token Flow] -> @tests/auth.test.ts : mockTimer, expireToken

```

## 3. Reference Implementation: `aics-gen`

The reference generator uses a **Universal Abstract Syntax Tree (AST)** engine to guarantee language agnosticism and deterministic output.

### 3.1. Core Architecture

* **Engine:** `web-tree-sitter` (WASM).
* **Query Layer:** S-Expression (`.scm`) queries define "Signature" nodes per language.
* **Determinism:** A `.aics-lock.json` file hashes source files to prevent unnecessary regeneration in CI/CD.

### 3.2. Governance Protocols

* **Adaptive Tiering:** If the generated index exceeds the Token Budget (default: 32k), the generator automatically degrades "Low Priority" modules from **Tier 1** (Full Skeletons) to **Tier 2** (Signatures Only) or **Tier 3** (Map Only).
* **Secret Sanitization:** A heuristic filter runs over the AST. Any string literal assigned to variables matching `*KEY*`, `*SECRET*`, or `*TOKEN*` is replaced with `"[REDACTED]"`.

---

# AICS-GEN: Command Line Interface Reference

This section defines the arguments and flags for the final compiled binary `aics`.

## Global Flags

These flags apply to every command.

* `-c, --config <path>`
* **Description:** Path to the configuration file.
* **Default:** `./aics.config.json`


* `-v, --verbose`
* **Description:** Enable detailed logging (parser events, tier degradation steps).


* `--no-color`
* **Description:** Disable ANSI color output (useful for CI logs).



## Primary Commands

### 1. `generate` (Alias: `gen`)

The main build command. Scans source, optimizes context, and writes the artifacts.

**Usage:** `aics gen [options]`

| Parameter | Type | Description |
| --- | --- | --- |
| `-i, --input <glob>` | `string` | Override input directory (e.g., `"src/**/*.ts"`). |
| `-o, --output <file>` | `string` | Output filename. **Default:** `.ai-index.md`. |
| `-b, --budget <int>` | `number` | **Crucial.** Hard token limit. **Default:** `32000`. |
| `--tier <1-3>` | `int` | **Force Mode.** Force all files to a specific compression tier. <br>

<br>`1`: Full Types <br>

<br>`2`: Signatures Only <br>

<br>`3`: Map Only. |
| `--dry-run` | `bool` | Runs the pipeline, prints token stats and proposed structure, but writes nothing to disk. |
| `--watch` | `bool` | Runs in daemon mode, regenerating the index instantly on file save. |
| `--clean` | `bool` | Ignores `.aics-lock.json` and forces a full re-parse of the codebase. |

### 2. `check`

The CI/CD enforcer. Ensures the index is valid and up-to-date.

**Usage:** `aics check [options]`

| Parameter | Type | Description |
| --- | --- | --- |
| `--strict` | `bool` | Fails with exit code 1 if *any* drift is detected. |
| `--lock-only` | `bool` | Fast check. Only verifies file hashes against `.aics-lock.json` without parsing AST. |
| `--diff` | `bool` | If drift is detected, outputs a diff showing exactly which API changes are missing from the index. |

### 3. `inspect`

Debugging tool. Shows exactly what the AI sees for a specific file.

**Usage:** `aics inspect <filepath>`

| Parameter | Type | Description |
| --- | --- | --- |
| `--raw` | `bool` | Outputs the raw AST nodes captured by Tree-sitter. |
| `--tokens` | `bool` | Prints the exact token count (using `tiktoken`) for that single file. |

### 4. `install-hook`

Sets up the development environment safeguards.

**Usage:** `aics install-hook`

| Parameter | Type | Description |
| --- | --- | --- |
| `--git` | `bool` | Installs a pre-commit hook (via Husky or native Git) that runs `aics check`. |

---

## Example Workflow

**1. Developer Setup:**

```bash
# Initialize project and install git hook
aics init --lang typescript
aics install-hook

```

**2. Building the Index (Local):**

```bash
# Generate index with a tight budget
aics gen --budget 16000 --output AGENTS.md

```

**3. CI Pipeline (GitHub Actions):**

```yaml
# In .github/workflows/ci.yml
- name: Verify AI Index
  run: aics check --strict --diff

```

You can treat this as the **Golden Source** for building `aics-gen`.

---
This is the final, complete specification for **AICS-GEN**. It incorporates the new language requirements (HTML, CSS, JS, R) into the "Universal Parser" architecture defined in the previous steps.

### **Project:** AICS-GEN (The AI Context Sitemap Generator)

**Protocol Version:** 1.0.0
**Core Stack:** Node.js, TypeScript, Web-Tree-Sitter (WASM)

---

### **1. Final Directory Structure**

The structure is standardized around the `assets/` directory to support the "Universal Parser" architecture.

```text
aics-gen/
├── bin/
│   └── aics.js                # CLI Entry Point
├── config/
│   └── default-config.ts      # Fallback settings (32k token limit)
├── assets/                    # [CRITICAL] The Language Brains
│   ├── languages/
│   │   ├── tree-sitter-typescript.wasm
│   │   ├── tree-sitter-javascript.wasm   # [NEW]
│   │   ├── tree-sitter-python.wasm
│   │   ├── tree-sitter-rust.wasm
│   │   ├── tree-sitter-r.wasm            # [NEW]
│   │   ├── tree-sitter-html.wasm         # [NEW]
│   │   └── tree-sitter-css.wasm          # [NEW]
│   └── queries/               # SCM files defining "What is a signature?"
│       ├── typescript.scm
│       ├── javascript.scm                # [NEW]
│       ├── python.scm
│       ├── rust.scm
│       ├── r.scm                         # [NEW]
│       ├── html.scm                      # [NEW]
│       └── css.scm                       # [NEW]
├── src/
│   ├── cli/                   # User Interaction
│   │   ├── index.ts           # Commander.js setup
│   │   ├── commands/
│   │   │   ├── init.ts        # Scaffolds config
│   │   │   ├── generate.ts    # Main pipeline execution
│   │   │   ├── check.ts       # CI/CD verification
│   │   │   └── install-hook.ts# Git hook setup
│   │   └── utils/
│   │       └── logger.ts
│   │
│   ├── core/                  # Orchestration
│   │   ├── pipeline.ts        # The main loop: Scan -> Parse -> Tier -> Write
│   │   ├── config.ts          # Loader for aics.config.json
│   │   └── cache.ts           # [PERF] Manages .aics-lock.json (hashing)
│   │
│   ├── engine/                # The Heavy Lifting
│   │   ├── scanner.ts         # fast-glob wrapper (ignoring .gitignore)
│   │   ├── universal.ts       # [CORE] The Web-Tree-Sitter wrapper
│   │   ├── sanitizer.ts       # [SEC] Redacts "SECRET_KEY" strings
│   │   ├── anchors.ts         # [LINK] Test discovery logic
│   │   └── tier-manager.ts    # [BUDGET] Smart-collapse logic
│   │
│   ├── writers/
│   │   └── markdown.ts        # Formats the final .ai-index.md
│   │
│   └── types/
│       └── index.d.ts         # Shared interfaces
├── tests/
├── package.json
├── tsconfig.json
└── README.md

```

---

### **2. The Core Logic Specifications**

#### **A. The "Universal Skeletonizer" (`src/engine/universal.ts`)**

This single engine handles all parsing by delegating to WASM binaries and SCM queries.

* **Input:** File Content (String), Language ID (e.g., "r", "html").
* **Action:**
1. Load the matching `.wasm` from `assets/languages/`.
2. Load the matching `.scm` query from `assets/queries/`.
3. Run the query against the code.


* **Output:** A "Skeleton String" containing *only* the captured nodes (signatures/definitions), stripped of bodies and comments.
* **Sanitization:** Before returning, pipe the output through `sanitizer.ts`.

#### **B. The Adaptive Tier Manager (`src/engine/tier-manager.ts`)**

Ensures the output fits the token window using a priority-based collapse strategy.

* **Logic:**
1. **Parse:** Process ALL files at **Tier 1** (Signatures + Types/Attributes).
2. **Count:** Calculate total tokens (using `tiktoken`).
3. **Check:** If Total > MaxTokens:
* **Sort:** Rank modules by *Utility Score* (Core > Utils > Legacy).
* **Collapse (T2):** Downgrade lowest priority files to **Tier 2** (Signatures only, no types/docs).


4. **Check Again:** If Still > MaxTokens:
* **Collapse (T3):** Downgrade lowest priority to **Tier 3** (File Path + Keywords only).


5. **Final Check:** If Still > MaxTokens:
* **Drop:** Remove the file from the index entirely (log a warning).





#### **C. Holographic Anchors (`src/engine/anchors.ts`)**

Connects source code to its validation (tests).

* **Process:**
1. Parse all `*.test.*` (or `*_test.R`) files.
2. **Extract Imports:** Map `import { User }` or `library(User)` → `src/User`.
3. **Extract Intent:** Grab the first string from `describe()`, `test_that()`, or equivalent.
4. **Output Map:** Append "Usage Pointers" to the relevant source file entry in the index.



#### **D. The Lockfile System (`src/core/cache.ts`)**

Prevents slow CI builds by hashing files.

* **File:** `.aics-lock.json`
* **Structure:**
```json
{
  "version": "1.0",
  "files": {
    "src/auth.ts": "sha256-hash-of-content",
    "src/utils.R": "sha256-hash-of-content"
  }
}

```


* **Check Logic:** On `aics check`, hash current files. If `currentHash == lockHash`, skip parsing.

---

### **3. Language Definitions (SCM Queries)**

You must populate `assets/queries/` with these definitions.

**R (`queries/r.scm`)**

```scheme
(function_definition
  (function_definition_body) @ignore) @signature

```

**HTML (`queries/html.scm`)**
*Captures custom elements and IDs, ignores generic structure.*

```scheme
(element
  (start_tag
    (tag_name) @signature
    (attribute
      (attribute_name) @attr-name
      (attribute_value) @attr-value) @keep-id-class)
  (#match? @keep-id-class "id|class")
  (children) @ignore)

```

**CSS (`queries/css.scm`)**
*Captures variables and class names.*

```scheme
(call_expression
  (function_name) @name (#eq? @name "var")
  (arguments (string) @signature))

(rule_set
  (selectors (class_selector) @signature)
  (block) @ignore)

```

**JavaScript (`queries/javascript.scm`)**

```scheme
(function_declaration
  name: (identifier) @signature
  parameters: (formal_parameters) @signature
  body: (statement_block) @ignore)

(class_declaration
  name: (identifier) @signature
  body: (class_body) @ignore)

```

---

### **4. Configuration Schema (`aics.config.json`)**

```json
{
  "input": ["src"],
  "output": ".ai-index.md",
  "budget": 32000,
  "tiers": {
    "protected": ["src/core/**"], // Never downgrade these
    "skeleton": ["src/styles/**", "src/templates/**"] // Default these to Tier 2/3
  },
  "secrets": {
    "patterns": ["*KEY*", "*TOKEN*", "password", "SECRET"] // Redact these variables
  }
}

```

---

### **5. Implementation Steps (The "Zero to Hero" Plan)**

1. **Setup:** `npm init`, install `commander`, `web-tree-sitter`, `fast-glob`, `tiktoken`.
2. **Asset Acquisition:** Download `.wasm` files for TS, Python, Rust, R, HTML, CSS, JS from the [tree-sitter-grammars](https://www.google.com/search?q=https://github.com/tree-sitter/tree-sitter-grammars) repo (or build them using `tree-sitter-cli`).
3. **The Engine:** Implement `UniversalSkeletonizer` logic (Section 2A).
4. **The Queries:** Create the `.scm` files in `assets/queries/`.
5. **The Glue:** Write `cli/generate.ts` to walk folders, feed them to the Engine, and write the `.ai-index.md`.
6. **The Polish:** Implement `Tier Manager` (Section 2B) and `Lockfile` (Section 2D).