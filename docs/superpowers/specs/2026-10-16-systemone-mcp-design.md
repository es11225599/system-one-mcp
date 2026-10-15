# SystemOne MCP — Design Spec
Date: 2026-10-16
Status: Approved, pending implementation plan

## Goal
One stdio MCP server (TypeScript, Node 20+) that exposes any System One decision model backend via the shared `POST /v1/systemone` shape:
- TypeSafe cloud (`https://api.typesafe.ai`, `jev-latest`, Bearer key)
- Ollama local (`http://localhost:11434`, `nimble`, `tev`, `clef`, `clef-flash`, no key)
- Kev self-host (`http://127.0.0.1:8009`, `kev-latest`, optional `KEV_API_KEY`)
- Laya self-host (`http://localhost:8000`, Router english/multilingual/typed-decisions)
- Future `laya` / `kev` / `tev` variants via free-form `model` string, no code change.

## Architecture
stdio MCP (`@modelcontextprotocol/sdk`) -> 2 tools -> `fetch {baseUrl}/v1/systemone` or `GET {baseUrl}/v1/models`.
Config via env: `SYSTEMONE_BASE_URL` (default `http://localhost:11434`), `SYSTEMONE_API_KEY` (optional Bearer), `SYSTEMONE_MODEL` (default `nimble`).

## Tools
1. `systemone_evaluate({ model?, state, questions, images?, keep_alive? })`
   - `model`: string, non-empty. Defaults to env default.
   - `state`: string | object | array (non-empty string enforced).
   - `questions`: map 1–64 entries, each `{type: choice|score|noul, instructions, criteria?}`.
     - choice criteria: object 2–255 options (Ollama caps at 26; pass through, let server enforce).
     - score criteria: array 2–10 levels.
     - noul criteria: optional `{true?, false?}`.
   - `images`: optional string[] base64 (Clef/vision only).
   - `keep_alive`: optional string|number (Ollama only, passthrough).
   - Returns `{ model, answers, usage }` as JSON text.
2. `systemone_list_models({})` -> `GET {baseUrl}/v1/models` -> `{ models: [{name, description?, release_date?}] }`. Versioned IDs accepted even if not listed.

## Data flow
Agent -> MCP tool call (Zod validate) -> POST JSON (single compression layer none; UTF-8) -> backend evaluates all questions in parallel against same state -> answers keyed by question id -> MCP returns JSON + `usage.input_tokens/output_tokens`.

## Error handling
Map HTTP to MCP errors, include server `error` body text:
- 400 invalid / context exceeded, 401 bad key, 404 model not pulled/found, 413 body too large (64 KiB no-image Ollama / 32 MiB TypeSafe), 422 validation, 429/529 retryable (surface `retry-after` hint; no auto-retry in v1).
- Missing `SYSTEMONE_API_KEY` when baseUrl is TypeSafe cloud: fail fast with config error.
- No truncation: oversize state returns server error, never silent cut.

## Testing
vitest + mocked fetch: schema validation, each primitive round-trip (choice/score/noul fixtures from Ollama + TypeSafe docs), multi-question batch, images passthrough, error mapping, list_models. Manual check vs `ollama pull nimble` + `curl localhost:11434/v1/systemone`.

## Non-goals (v1)
No auto-retry/backoff, no batching across requests, no fine-tune/deploy helpers, no Playground UI.
