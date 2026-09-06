export const PIN_LABELS: Record<string, string> = {
  PS4_RY: "right stick Y",
  PS4_RX: "right stick X",
  PS4_LY: "left stick Y",
  PS4_LX: "left stick X",
  PS4_R2: "R2 trigger",
  PS4_L2: "L2 trigger",
  PS4_R1: "R1 bumper",
  PS4_L1: "L1 bumper",
  PS4_CIRCLE: "circle",
  PS4_CROSS: "cross",
  PS4_TRIANGLE: "triangle",
  PS4_SQUARE: "square",
  PS4_L3: "left stick press",
  PS4_R3: "right stick press",
  PS4_UP: "d-pad up",
  PS4_DOWN: "d-pad down",
  PS4_LEFT: "d-pad left",
  PS4_RIGHT: "d-pad right",
  PS4_OPTIONS: "options",
  PS4_SHARE: "share",
  PS4_TOUCH: "touchpad",
  XB1_RY: "right stick Y",
  XB1_RX: "right stick X",
  XB1_LY: "left stick Y",
  XB1_LX: "left stick X",
};

export const STICK_X = /(RX|LX|X)$/;
export const STICK_Y = /(RY|LY|Y)$/;

export type Step = { t: number; label: string; pin?: string; value?: number };

function resolveInt(raw: string, vars: Map<string, number>): number | undefined {
  const t = raw.trim().replace(/^\(+/, "").replace(/\)+$/, "");
  if (/^\d+$/.test(t)) return Number(t);
  return vars.get(t);
}

/**
 * Turns a GPC body into a flat step timeline so it can be animated.
 * Returns an empty array when no timeline can be inferred.
 */
export function parseSteps(src: string): Step[] {
  const steps: Step[] = [];
  const vars = new Map<string, number>();
  let t = 0;

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;

    const varMatch = /^int\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;/.exec(line);
    if (varMatch) {
      vars.set(varMatch[1], Number(varMatch[2]));
      continue;
    }

    const waitMatch = /^wait(?:_for)?\s*\(([^)]*)\)\s*;/.exec(line);
    if (waitMatch) {
      const v = resolveInt(waitMatch[1], vars);
      if (typeof v === "number") t += Math.max(0, v);
      continue;
    }

    const setMatch = /^(set_val|set_led)\s*\(([^,]+),\s*([^)]+)\)\s*;/.exec(line);
    if (setMatch) {
      const pin = setMatch[2].trim();
      steps.push({
        t,
        label: `set ${PIN_LABELS[pin] || pin} = ${setMatch[3].trim()}`,
        pin,
        value: resolveInt(setMatch[3], vars),
      });
      continue;
    }

    const eventMatch = /^(event_press|event_release)\s*\(([^)]+)\)\s*;/.exec(line);
    if (eventMatch) {
      const pin = eventMatch[2].trim();
      steps.push({
        t,
        label: `${eventMatch[1] === "event_press" ? "press" : "release"} ${PIN_LABELS[pin] || pin}`,
        pin,
      });
      continue;
    }

    const comboRun = /^combo_run\s*\(([^)]+)\)\s*;/.exec(line);
    if (comboRun) {
      steps.push({ t, label: `run combo ${comboRun[1].trim()}` });
      continue;
    }
  }

  // Normalize: keep monotonic timestamps so the timeline always moves forward.
  let last = -1;
  for (const s of steps) {
    if (s.t <= last) s.t = last + 1;
    last = s.t;
  }
  return steps;
}