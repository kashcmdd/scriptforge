import { describe, it, expect } from "vitest";
import { parseSteps, STICK_X, STICK_Y } from "@/lib/gpc";

describe("parseSteps", () => {
  it("parses set_val with known and unknown pins", () => {
    const steps = parseSteps(`main {
      set_val(PS4_RY, 8);
      set_val(PS4_UNKNOWN, 100);
    }`);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ t: 0, pin: "PS4_RY", value: 8, label: "set right stick Y = 8" });
    expect(steps[1]).toMatchObject({ pin: "PS4_UNKNOWN", label: "set PS4_UNKNOWN = 100" });
  });

  it("accumulates wait() time into steps", () => {
    const steps = parseSteps(`
      set_val(PS4_R2, 100);
      wait(20);
      set_val(PS4_R2, 0);
    `);
    expect(steps).toHaveLength(2);
    expect(steps[0].t).toBe(0);
    expect(steps[1].t).toBe(20);
  });

  it("supports int variables in expressions", () => {
    const steps = parseSteps(`int vertical = 8;
      set_val(PS4_RY, vertical);
      wait_for(v / 2 + 0);
    `);
    expect(steps).toHaveLength(1);
    expect(steps[0].value).toBe(8);
  });

  it("parses event_press / event_release and combo_run", () => {
    const steps = parseSteps(`
      combo_run(pulse);
      event_press(PS4_L3);
      event_release(PS4_L3);
    `);
    expect(steps.map((s) => s.label)).toEqual([
      "run combo pulse",
      "press left stick press",
      "release left stick press",
    ]);
  });

  it("ignores comments and blank lines", () => {
    const steps = parseSteps(`
      // a comment
      /*
       * block comment
       */
      set_val(PS4_LX, 50);
    `);
    expect(steps).toHaveLength(1);
  });

  it("returns an empty timeline for non-command source", () => {
    expect(parseSteps("int x = 1; // only vars")).toEqual([]);
    expect(parseSteps("")).toEqual([]);
  });

  it("enforces monotonic timestamps", () => {
    const steps = parseSteps(`
      set_val(PS4_RX, 100);
      set_val(PS4_RY, 100);
      set_val(PS4_RY, 0);
    `);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].t).toBeGreaterThan(steps[i - 1].t);
    }
  });

  it("resolves value ranges under the stick magnitude", () => {
    expect(STICK_X.test("PS4_RX")).toBe(true);
    expect(STICK_X.test("PS4_LY")).toBe(false);
    expect(STICK_Y.test("PS4_RY")).toBe(true);
    expect(STICK_Y.test("PS4_CIRCLE")).toBe(false);
  });
});