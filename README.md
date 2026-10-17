# systemone-mcp

MCP server for any System One backend (Ollama nimble/tev/clef, TypeSafe jev, Kev, Laya).

Exposes two stdio tools:

- `systemone_evaluate` — answer typed `choice` / `score` / `noul` questions with a System One model
- `systemone_list_models` — list available System One models on the configured backend

Thin Zod-validated passthrough: MCP tools -> `fetch({baseUrl}/v1/systemone)` with optional Bearer key. `model` is a free-form non-empty string (never a hard-coded enum).

Run it with `npx` or `bunx` — see [Install](#install).

## Env

| Variable | Default | Notes |
|---|---|---|
| `SYSTEMONE_BASE_URL` | `http://localhost:11434` | Must start with `http://` or `https://`. Ollama default `http://localhost:11434`. |
| `SYSTEMONE_API_KEY` | (unset) | Optional. TypeSafe cloud / Kev with key / Laya with `LAYA_API_KEY`. Sent as `Authorization: Bearer <key>`. |
| `SYSTEMONE_MODEL` | `nimble` | Default model when the tool call omits `model`. Any of `nimble` / `tev` / `clef` / `jev` / `kev` / `laya`. |

See `.env.example` for a copy-paste starting point.

## Install

No build, no clone, no `npm install` — the published package ships prebuilt, so `npx`/`bunx` fetch a ready-to-run server.

```bash
npx -y @es11225599/systemone-mcp
```

```bash
bunx @es11225599/systemone-mcp
```

Requires Node >= 20 (or Bun). First run downloads the package; later runs are cached.

## Run

### npx / bunx (recommended)

Point any MCP client at the runner. Nothing to build or install locally:

```json
{
  "mcpServers": {
    "system-one": {
      "command": "npx",
      "args": ["-y", "@es11225599/systemone-mcp"],
      "env": {
        "SYSTEMONE_BASE_URL": "http://localhost:11434",
        "SYSTEMONE_MODEL": "nimble"
      }
    }
  }
}
```

With Bun, swap the command and args:

```json
{
  "mcpServers": {
    "system-one": {
      "command": "bunx",
      "args": ["@es11225599/systemone-mcp"],
      "env": {
        "SYSTEMONE_BASE_URL": "http://localhost:11434",
        "SYSTEMONE_MODEL": "nimble"
      }
    }
  }
}
```

Both forward stdio, so the server is fully wired either way. If your client resolves binaries through a shell, `npx.cmd` / `bunx.cmd` are the Windows equivalents.

### Claude Code

```bash
claude mcp add system-one \
  -e SYSTEMONE_BASE_URL=http://localhost:11434 \
  -e SYSTEMONE_MODEL=nimble \
  -- npx -y @es11225599/systemone-mcp
```

### From a clone (development)

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

`npm run dev` (tsx) skips the build for local iteration.

For TypeSafe cloud / Kev / Laya, add `"SYSTEMONE_API_KEY": "<key>"` to `env` and point `SYSTEMONE_BASE_URL` at that backend.

## Manual parity

Direct HTTP check against an Ollama backend running `nimble` (bypasses MCP, same endpoint the server calls):

```bash
curl http://localhost:11434/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"nimble","state":"Our checkout has returned 500 errors since 9am.","questions":{"label":{"type":"choice","instructions":"Which label fits?","criteria":{"billing":"Payments","bug":"Errors","account":"Login"}}}}'
```

Expected: JSON with `model`, `answers.label`, and `usage` (`input_tokens` / `output_tokens`).
