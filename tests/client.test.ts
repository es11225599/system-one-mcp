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
