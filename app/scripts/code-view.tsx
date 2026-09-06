import { ReactNode } from "react";

const KEYWORDS = new Set([
  "main",
  "combo",
  "combo_run",
  "combo_stop",
  "if",
  "else",
  "while",
  "return",
  "int",
  "bool",
  "true",
  "false",
  "set_val",
  "set_led",
  "get_val",
  "get_ival",
  "event_press",
  "event_release",
  "wait",
  "wait_for",
  "adjust",
  "pulse",
  "hold",
  "release",
]);

function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < line.length) {
    if (line.startsWith("//", i)) {
      out.push(
        <span key={key++} className="code-cmt">
          {line.slice(i)}
        </span>
      );
      break;
    }

    const ch = line[i];
    if (ch === '"' || ch === "'") {
      const end = line.indexOf(ch, i + 1);
      const slice = end === -1 ? line.slice(i) : line.slice(i, end + 1);
      out.push(
        <span key={key++} className="code-str">
          {slice}
        </span>
      );
      i += slice.length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i))!;
      const word = match[0];
      if (KEYWORDS.has(word)) {
        out.push(
          <span key={key++} className="code-kw">
            {word}
          </span>
        );
      } else {
        out.push(word);
      }
      i += word.length;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+/.exec(line.slice(i))!;
      const num = match[0];
      out.push(
        <span key={key++} className="code-num">
          {num}
        </span>
      );
      i += num.length;
      continue;
    }

    out.push(ch);
    i += 1;
  }

  return out;
}

export default function CodeView({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="code-shell">
      {lines.map((line, idx) => (
        <div className="code-line" key={idx}>
          <span className="code-gutter">{String(idx + 1).padStart(3, "0")}</span>
          <code className="code-text">{line ? highlightLine(line) : "\u00a0"}</code>
        </div>
      ))}
    </div>
  );
}