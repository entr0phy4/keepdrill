# Phase 8 WASM ABI Pin

Spike: 2026-09-20 in `/tmp/keebdrill-wasm-abi` (outside this repo).
Node: v24.16.0. Grammar install used `--ignore-scripts`.

## Pin

| Field | Value |
|-------|-------|
| `runtime` | `web-tree-sitter@0.27.0` |
| `runtime_wasm` | `web-tree-sitter.wasm` |
| `grammars` | `tree-sitter-typescript@0.23.2` |
| `typescript_wasm` | `/wasm/tree-sitter-typescript.wasm` |
| `tsx_wasm` | `/wasm/tree-sitter-tsx.wasm` |
| `cli_rebuild` | `false` |

## Matrix

1. **web-tree-sitter 0.27.0 + tree-sitter-typescript 0.23.2** — **WINNER**
   - `Parser.init` `locateFile` requested `"web-tree-sitter.wasm"` (not the README `tree-sitter.wasm` name).
   - `ls node_modules/web-tree-sitter/*.wasm` → `web-tree-sitter.wasm` only.
   - `Language.load` typescript wasm: OK, `abiVersion=14`.
   - `Language.load` tsx wasm: OK, `abiVersion=14`.
   - Smoke parse: `export function foo() { return 1 }` and `export const X = () => <div />` both rooted at `program`.
   - No empty `Error` / `dylink` throw.
2. web-tree-sitter 0.25.10 — **not run** (step 1 succeeded).
3. `tree-sitter-cli` — **not installed**. `cli_rebuild: false`.

## Task 3 copy targets

```
public/web-tree-sitter.wasm
public/wasm/tree-sitter-typescript.wasm
public/wasm/tree-sitter-tsx.wasm
```

`src/parse/wasm.ts` is not created in this plan. 08-04 will `Parser.init({ locateFile: (scriptName) => `/${scriptName}` })`.
