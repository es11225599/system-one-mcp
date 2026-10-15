# SystemOne MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stdio TypeScript MCP server exposing `systemone_evaluate` + `systemone_list_models` against any System One backend (Ollama, TypeSafe, Kev, Laya).

**Architecture:** Thin Zod-validated passthrough: MCP tools -> `fetch({baseUrl}/v1/systemone)` with optional Bearer key, free-form `model` string. No SDK dependency.

**Tech Stack:** Node 20+, TypeScript 5, `@modelcontextprotocol/sdk`, `zod`, `vitest`, `tsx`

## Global Constraints

- Node >= 20.0.0
- Transport: stdio only (v1)
- Env: `SYSTEMONE_BASE_URL` default `http://localhost:11434`, `SYSTEMONE_API_KEY` optional, `SYSTEMONE_MODEL` default `nimble`
- `model` is free-form non-empty string, never hard-coded enum
- `questions` map 1–64 entries; choice criteria 2–255 options; score criteria 2–10 levels
- No truncation of oversize state; surface server 400/401/404/413/422/429 as MCP errors
- YAGNI: no retry, no fine-tune, no UI

---

## File Structure

- Create: `package.json` — scripts, deps
- Create: `tsconfig.json` — strict TS, ESM, outDir dist
- Create: `src/config.ts` — env loading, one responsibility
- Create: `src/schemas.ts` — Zod schemas for tools, one responsibility
- Create: `src/client.ts` — HTTP client for systemone + models, one responsibility
- Create: `src/index.ts` — MCP server wiring + tool handlers, one responsibility
- Create: `tests/client.test.ts` — mocked fetch tests
- Create: `tests/schemas.test.ts` — validation tests
- Create: `.env.example` — documented env vars
- Create: `README.md` — setup + Claude Code config

---

### Task 1: Scaffold TS project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Test: `tests/schemas.test.ts` (placeholder file to prove vitest runs)

**Interfaces:**
- Consumes: none
- Produces: runnable `npm test` + `npm run build`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schemas.test.ts
import { describe, it, expect } from "vitest";
describe("scaffold", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (missing deps)**

Run: `npm test`
Expected: FAIL with "vitest: not found" / missing package.json scripts

- [ ] **Step 3: Write minimal implementation**

```json
// package.json
{
  "name": "system-one-mcp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.16.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  },
  "engines": { "node": ">=20" }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

```text
# .env.example
SYSTEMONE_BASE_URL=http://localhost:11434
# SYSTEMONE_API_KEY= (only for TypeSafe cloud / Kev with key / Laya with LAYA_API_KEY)
SYSTEMONE_MODEL=nimble
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install` then `npm test`
Expected: PASS 1 test in tests/schemas.test.ts

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .env.example tests/schemas.test.ts
git commit -m "feat: scaffold TS MCP project"
```

---

### Task 2: Config + Zod schemas

**Files:**
- Create: `src/config.ts`
- Create: `src/schemas.ts`
- Modify: `tests/schemas.test.ts`

**Interfaces:**
- Consumes: `process.env`
- Produces: `getConfig(): { baseUrl, apiKey?, defaultModel }`, `EvaluateInput` type + `EvaluateSchema`, `ListModelsSchema`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schemas.test.ts
import { describe, it, expect } from "vitest";
import { EvaluateSchema } from "../src/schemas.js";

describe("schemas", () => {
  it("accepts minimal noul evaluate", () => {
    const parsed = EvaluateSchema.parse({
      state: "Our checkout has returned 500 errors since 9am.",
      questions: {
        label: { type: "noul", instructions: "Is a refund requested?" }
      }
    });
    expect(parsed.questions.label.type).toBe("noul");
  });
  it("rejects empty questions", () => {
    expect(() =>
      EvaluateSchema.parse({ state: "x", questions: {} })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schemas.test.ts`
Expected: FAIL with "Cannot find module '../src/schemas.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config.ts
export interface SystemOneConfig {
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
}

export function getConfig(env = process.env): SystemOneConfig {
  const baseUrl = (env.SYSTEMONE_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  const apiKey = env.SYSTEMONE_API_KEY || undefined;
  const defaultModel = env.SYSTEMONE_MODEL || "nimble";
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    throw new Error(`SYSTEMONE_BASE_URL must start with http:// or https://, got: ${baseUrl}`);
  }
  if (!defaultModel.trim()) throw new Error("SYSTEMONE_MODEL must be non-empty");
  return { baseUrl, apiKey, defaultModel };
}
```

```ts
// src/schemas.ts
import { z } from "zod";

const ContentSchema = z.union([z.string().min(1), z.record(z.unknown()), z.array(z.unknown())]);

const ChoiceQuestion = z.object({
  type: z.literal("choice"),
  instructions: ContentSchema,
  criteria: z.record(z.union([z.string(), z.null()])).refine((o) => Object.keys(o).length >= 2 && Object.keys(o).length <= 255, {
    message: "choice criteria must have 2-255 options"
  })
});

const NoulQuestion = z.object({
  type: z.literal("noul"),
  instructions: ContentSchema,
  criteria: z.object({ true: z.string().optional(), false: z.string().optional() }).strict().optional()
});

const ScoreQuestion = z.object({
  type: z.literal("score"),
  instructions: ContentSchema,
  criteria: z.array(z.string()).min(2).max(10)
});

const QuestionSchema = z.discriminatedUnion("type", [ChoiceQuestion, NoulQuestion, ScoreQuestion]);

export const EvaluateSchema = z.object({
  model: z.string().min(1).optional(),
  state: ContentSchema,
  questions: z.record(QuestionSchema).refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 64, {
    message: "questions must have 1-64 entries"
  }),
  images: z.array(z.string().min(1)).optional(),
  keep_alive: z.union([z.string(), z.number()]).optional()
});

export type EvaluateInput = z.infer<typeof EvaluateSchema>;
export const ListModelsSchema = z.object({});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/schemas.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/schemas.ts tests/schemas.test.ts
git commit -m "feat: add config and zod schemas"
```

---

### Task 3: SystemOne HTTP client

**Files:**
- Create: `src/client.ts`
- Create: `tests/client.test.ts`

**Interfaces:**
- Consumes: `getConfig()`, `EvaluateInput`
- Produces: `evaluate(input): Promise<{model, answers, usage}>`, `listModels(): Promise<{models}>`, `SystemOneError extends Error { status }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/client.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { SystemOneClient } from "../src/client.js";

afterEach(() => vi.unstubAllGlobals());

describe("client", () => {
  it("sends evaluate with model default", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ model: "nimble", answers: { q1: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 10, output_tokens: 1 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    const res = await c.evaluate({ state: "hi", questions: { q1: { type: "noul", instructions: "yes?" } } });
    expect(res.answers.q1.noul).toBe(0.9);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/v1/systemone");
  });
  it("maps 404 to error with status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })));
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    await expect(c.evaluate({ state: "hi", questions: { q1: { type: "noul", instructions: "yes?" } } })).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/client.test.ts`
Expected: FAIL with "Cannot find module '../src/client.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/client.ts
import type { SystemOneConfig } from "./config.js";
import type { EvaluateInput } from "./schemas.js";

export class SystemOneError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`SystemOne HTTP ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

export class SystemOneClient {
  constructor(private cfg: SystemOneConfig) {}
  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey) h["Authorization"] = `Bearer ${this.cfg.apiKey}`;
    return h;
  }
  async evaluate(input: EvaluateInput) {
    const body = { model: input.model ?? this.cfg.defaultModel, state: input.state, questions: input.questions, ...(input.images ? { images: input.images } : {}), ...(input.keep_alive !== undefined ? { keep_alive: input.keep_alive } : {}) };
    const res = await fetch(`${this.cfg.baseUrl}/v1/systemone`, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw new SystemOneError(res.status, text);
    return JSON.parse(text) as { model: string; answers: Record<string, any>; usage: { input_tokens: number; output_tokens: number } };
  }
  async listModels() {
    const res = await fetch(`${this.cfg.baseUrl}/v1/models`, { headers: this.headers() });
    const text = await res.text();
    if (!res.ok) throw new SystemOneError(res.status, text);
    return JSON.parse(text) as { models: Array<{ name: string; description?: string; release_date?: string }> };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/client.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/client.ts tests/client.test.ts
git commit -m "feat: add systemone http client"
```

---

### Task 4: MCP server wiring

**Files:**
- Create: `src/index.ts`
- Modify: `package.json` (add `bin` + `files` if missing — fold into this task)

**Interfaces:**
- Consumes: `getConfig()`, `EvaluateSchema`, `SystemOneClient`
- Produces: stdio server with tools `systemone_evaluate`, `systemone_list_models`

- [ ] **Step 1: Write the failing test**

Manual test script (no vitest): `npm run dev` should list 2 tools. Before implementation it fails with "Cannot find module".

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: FAIL with "src/index.ts not found"

- [ ] **Step 3: Write minimal implementation**

```ts
#!/usr/bin/env node
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { EvaluateSchema } from "./schemas.js";
import { SystemOneClient, SystemOneError } from "./client.js";

const cfg = getConfig();
const client = new SystemOneClient(cfg);
const server = new McpServer({ name: "system-one-mcp", version: "0.1.0" });

server.tool("systemone_evaluate", "Answer typed choice/score/noul questions with a System One model (jev/nimble/kev/tev/laya).", EvaluateSchema.shape, async (args) => {
  try {
    const input = EvaluateSchema.parse(args);
    const res = await client.evaluate(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
  } catch (e: any) {
    const msg = e instanceof SystemOneError ? `SystemOne HTTP ${e.status}: ${e.body}` : (e?.message ?? String(e));
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
});

server.tool("systemone_list_models", "List available System One models on the configured backend.", {}, async () => {
  try {
    const res = await client.listModels();
    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
  } catch (e: any) {
    return { content: [{ type: "text" as const, text: `Error: ${e?.message ?? e}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Add bin entry to package.json:

```json
{
  "bin": { "system-one-mcp": "dist/index.js" },
  "files": ["dist"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js`
Expected: JSON response listing `systemone_evaluate` + `systemone_list_models` (MCP stdio framing; verify no crash, exit 0 on build)

Run: `npm test`
Expected: PASS all (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: add stdio MCP server with 2 tools"
```

---

### Task 5: README + integration check

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: built `dist/index.js`
- Produces: documented Claude Code / Codex setup + manual curl parity check

- [ ] **Step 1: Write the failing test**

Check: `README.md` missing. Run `test -f README.md` -> FAIL.

- [ ] **Step 2: Run test to verify it fails**

Run: `test -f README.md && echo ok || echo missing`
Expected: `missing`

- [ ] **Step 3: Write minimal implementation**

```md
# system-one-mcp
MCP for any System One backend (Ollama nimble/tev/clef, TypeSafe jev, Kev, Laya).
## Env
SYSTEMONE_BASE_URL=http://localhost:11434
SYSTEMONE_API_KEY= (optional, TypeSafe cloud only)
SYSTEMONE_MODEL=nimble
## Run
npm install && npm run build && SYSTEMONE_BASE_URL=http://localhost:11434 node dist/index.js
## Claude Code
{"mcpServers":{"system-one":{"command":"node","args":["<path-to-system-one-mcp>/dist/index.js"],"env":{"SYSTEMONE_BASE_URL":"http://localhost:11434","SYSTEMONE_MODEL":"nimble"}}}}
## Manual parity
curl http://localhost:11434/v1/systemone -H 'Content-Type: application/json' -d '{"model":"nimble","state":"Our checkout has returned 500 errors since 9am.","questions":{"label":{"type":"choice","instructions":"Which label fits?","criteria":{"billing":"Payments","bug":"Errors","account":"Login"}}}}'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && npm test && test -f README.md && echo ok`
Expected: `ok`, all tests PASS

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add readme and setup"
```

---

## Self-Review

- Spec coverage: evaluate + list_models, free-form model (laya/kev/tev/jev/nimble), images/keep_alive passthrough, env config, error codes, vitest — each has a task above.
- No placeholders: all steps include exact code/commands.
- Type consistency: `EvaluateInput` from Zod used in client; server uses `EvaluateSchema.shape`; config type shared.
