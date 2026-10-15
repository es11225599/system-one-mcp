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
    expect((res.answers.q1 as { noul: number }).noul).toBe(0.9);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/v1/systemone");
  });
  it("maps 404 to error with status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })));
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    await expect(c.evaluate({ state: "hi", questions: { q1: { type: "noul", instructions: "yes?" } } })).rejects.toMatchObject({ status: 404 });
  });
  it("round-trips choice + score answers", async () => {
    const payload = {
      model: "nimble",
      answers: { color: { type: "choice", choice: "red" }, quality: { type: "score", score: 8 } },
      usage: { input_tokens: 20, output_tokens: 2 },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    const res = await c.evaluate({
      state: "pick a color",
      questions: {
        color: { type: "choice", instructions: "Pick one", criteria: { red: "warm", blue: "cool" } },
        quality: { type: "score", instructions: "Rate it", criteria: ["speed", "clarity"] },
      },
    });
    expect(res.answers.color).toEqual({ type: "choice", choice: "red" });
    expect(res.answers.quality).toEqual({ type: "score", score: 8 });
  });
  it("sends multi-question batch in one request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ model: "nimble", answers: { a: 1, b: 2, c: 3 }, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    await c.evaluate({
      state: "batch",
      questions: {
        a: { type: "noul", instructions: "a?" },
        b: { type: "noul", instructions: "b?" },
        c: { type: "noul", instructions: "c?" },
      },
    });
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}")) as { questions: Record<string, unknown> };
    expect(Object.keys(sent.questions).sort()).toEqual(["a", "b", "c"]);
  });
  it("passes images and keep_alive through to the wire", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ model: "nimble", answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    await c.evaluate({
      state: "img",
      questions: { q1: { type: "noul", instructions: "yes?" } },
      images: ["base64data"],
      keep_alive: "10m",
    });
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}")) as { images?: unknown; keep_alive?: unknown };
    expect(sent.images).toEqual(["base64data"]);
    expect(sent.keep_alive).toBe("10m");
  });
  it("returns listModels payload on success", async () => {
    const payload = { models: [{ name: "nimble", description: "fast", release_date: "2026-01-01" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    const res = await c.listModels();
    expect(res.models).toEqual(payload.models);
  });
  it("maps 429 to error including retry-after hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { "retry-after": "30" } }))
    );
    const c = new SystemOneClient({ baseUrl: "http://localhost:11434", defaultModel: "nimble" });
    const err = await c.evaluate({ state: "hi", questions: { q1: { type: "noul", instructions: "yes?" } } }).catch((e) => e);
    expect(err).toMatchObject({ status: 429 });
    expect(String(err.message)).toContain("retry-after: 30");
    expect(err.retryAfter).toBe("30");
  });
});
