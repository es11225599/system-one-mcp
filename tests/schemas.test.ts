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
