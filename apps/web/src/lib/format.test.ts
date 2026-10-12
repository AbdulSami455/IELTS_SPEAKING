import { describe, expect, it } from "vitest";
import { attemptStatus, bandDomain, bandText, criterionLabel, formatDate, humanize } from "./format";

describe("bandText", () => {
  it("prints half bands with one decimal", () => {
    expect(bandText(6.5)).toBe("6.5");
    expect(bandText(7)).toBe("7.0");
  });
  it("uses a dash when there is no band", () => {
    expect(bandText(undefined)).toBe("—");
    expect(bandText(null)).toBe("—");
  });
});

describe("bandDomain", () => {
  it("brackets the observed bands with whole-number ticks", () => {
    const [low, high] = bandDomain([6, 6.5, 7]);
    expect(Number.isInteger(low)).toBe(true);
    expect(Number.isInteger(high)).toBe(true);
    expect(low).toBeLessThanOrEqual(6);
    expect(high).toBeGreaterThanOrEqual(7);
    expect(high).toBeLessThanOrEqual(9);
    expect(low).toBeGreaterThanOrEqual(0);
  });
  it("ignores missing values and still returns a usable range", () => {
    const [low, high] = bandDomain([undefined, null]);
    expect(high - low).toBeGreaterThanOrEqual(1);
  });
});

describe("labels", () => {
  it("humanises snake case", () => {
    expect(humanize("lexical_resource").toLowerCase()).toBe("lexical resource");
  });
  it("maps criterion keys to display labels", () => {
    expect(criterionLabel("fluency_and_coherence")).toMatch(/fluency/i);
    expect(criterionLabel("pronunciation")).toMatch(/pronunciation/i);
  });
  it("describes attempt states for the history list", () => {
    expect(attemptStatus("COMPLETED").label.length).toBeGreaterThan(0);
    expect(attemptStatus("FAILED").tone).toBe("danger");
    expect(attemptStatus("CREATED").tone).not.toBe("success");
  });
});

describe("formatDate", () => {
  it("renders an ISO timestamp as a short date", () => {
    expect(formatDate("2026-10-11T08:50:00Z")).toMatch(/2026/);
    expect(formatDate(undefined)).toBe("");
  });
});
