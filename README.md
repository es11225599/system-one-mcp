# system-one-mcp

MCP server for any System One backend (Ollama nimble/tev/clef, TypeSafe jev, Kev, Laya).

Exposes two stdio tools:

- `systemone_evaluate` — answer typed `choice` / `score` / `noul` questions with a System One model
- `systemone_list_models` — list available System One models on the configured backend

Thin Zod-validated passthrough: MCP tools -> `fetch({baseUrl}/v1/systemone)` with optional Bearer key. `model` is a free-form non-empty string (never a hard-coded enum).

## Env

| Variable | Default | Notes |
|---|---|---|
| `SYSTEMONE_BASE_URL` | `http://localhost:11434` | Must start with `http://` or `https://`. Ollama default `http://localhost:11434`. |
| `SYSTEMONE_API_KEY` | (unset) | Optional. TypeSafe cloud / Kev with key / Laya with `LAYA_API_KEY`. Sent as `Authorization: Bearer <key>`. |
| `SYSTEMONE_MODEL` | `nimble` | Default model when the tool call omits `model`. Any of `nimble` / `tev` / `clef` / `jev` / `kev` / `laya`. |

See `.env.example` for a copy-paste starting point.

## Run

```bash
npm install
npm run build
SYSTEMONE_BASE_URL=http://localhost:11434 node dist/index.js
```

Windows PowerShell:

```powershell
npm install
npm run build
$env:SYSTEMONE_BASE_URL="http://localhost:11434"; node dist/index.js
```

## Claude Code

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "system-one": {
      "command": "node",
      "args": ["<path-to-system-one-mcp>/dist/index.js"],
      "env": {
        "SYSTEMONE_BASE_URL": "http://localhost:11434",
        "SYSTEMONE_MODEL": "nimble"
      }
    }
  }
}
```

For TypeSafe cloud / Kev / Laya, add `"SYSTEMONE_API_KEY": "<key>"` to `env` and point `SYSTEMONE_BASE_URL` at that backend.

## Manual parity

Direct HTTP check against an Ollama backend running `nimble` (bypasses MCP, same endpoint the server calls):

```bash
curl http://localhost:11434/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"nimble","state":"Our checkout has returned 500 errors since 9am.","questions":{"label":{"type":"choice","instructions":"Which label fits?","criteria":{"billing":"Payments","bug":"Errors","account":"Login"}}}}'
```

Expected: JSON with `model`, `answers.label`, and `usage` (`input_tokens` / `output_tokens`).
