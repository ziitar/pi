import { describe, it, expect } from "vitest";
import { buildClassifierPrompt } from "../prompt-builder.ts";
import { CATEGORIES } from "../types.ts";

describe("buildClassifierPrompt", () => {
  const prompt = buildClassifierPrompt();

  it("contains all category names", () => {
    for (const category of CATEGORIES) {
      expect(prompt).toContain(category);
    }
  });

  it("instructs JSON-only output", () => {
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("ONLY");
  });

  it("includes examples", () => {
    expect(prompt).toContain("coding");
    expect(prompt).toContain("writing-cn");
    expect(prompt).toContain("creative");
  });

  it("specifies output format", () => {
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"confidence"');
  });

  it("token count is reasonable", () => {
    // Rough estimate: ~4 chars per token
    const estimatedTokens = prompt.length / 4;
    expect(estimatedTokens).toBeLessThan(1000);
  });
});
