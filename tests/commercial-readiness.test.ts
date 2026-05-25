import { describe, expect, test } from "vitest";

import { assertCommercialReadiness, commercialReadinessReport } from "../src/commercial-readiness.ts";

describe("commercial readiness gates", () => {
  test("maps the commercial product ask to explicit evidence", () => {
    const report = commercialReadinessReport();

    expect(report.score).toBe(100);
    expect(report.gates.map((gate) => gate.id)).toEqual([
      "commercial_product_surface",
      "playable_graphics",
      "long_running_agents",
      "world_ingest",
      "proper_playability",
      "verification_and_positioning",
    ]);
    expect(() => assertCommercialReadiness(report)).not.toThrow();
  });

  test("keeps every commercial requirement auditable", () => {
    const report = commercialReadinessReport();

    for (const gate of report.gates) {
      expect(gate.evidence.length + gate.missing.length).toBeGreaterThan(0);
    }
  });
});
