import { expect, test } from "vitest";

// Fails on purpose: checks that branch protection keeps a PR with red CI out of main.
// The PR with this file is closed, never merged
test("fails on purpose to check branch protection", () => {
  expect(1 + 1).toBe(3);
});
