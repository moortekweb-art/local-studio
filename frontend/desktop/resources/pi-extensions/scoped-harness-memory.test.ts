import { describe, expect, test } from "bun:test";
import { harnessTaskProjection, projectMemorySection } from "./scoped-harness-memory";

describe("scoped Harness memory", () => {
  test("projects only the verification boundary fields", () => {
    const projected = harnessTaskProjection({
      task: {
        id: "task-a",
        objective: "Remember verified work",
        status: "done",
        summary: "The alpha canary passed.",
        verification: ["check passed", { passed: true }, { passed: false }],
        final_result: { accepted: true, worker_claim: "ignored" },
        advanced_details: { command: "ignored" },
      },
    });

    expect(projected).toEqual({
      id: "task-a",
      objective: "Remember verified work",
      status: "done",
      summary: "The alpha canary passed.",
      verification: ["check passed", { passed: true }, { passed: false }],
      final_result: { accepted: true },
    });
  });

  test("injects only non-empty scoped recall", () => {
    expect(projectMemorySection({ ok: true, result_count: 0, context: "none" })).toBeNull();
    const section = projectMemorySection({
      ok: true,
      scope: "project:abc123",
      result_count: 1,
      context: "Verified Harness outcome for alpha.",
    });
    expect(section).toContain("Local Studio verified project memory:");
    expect(section).toContain("Scope: project:abc123");
    expect(section).toContain("Verified Harness outcome for alpha.");
  });
});
