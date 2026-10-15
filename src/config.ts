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
