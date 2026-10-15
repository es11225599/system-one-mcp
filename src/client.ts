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
