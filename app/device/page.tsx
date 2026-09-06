"use client";
import { useEffect, useRef, useState } from "react";
import ScriptPreview from "@/app/scripts/script-preview";

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
const QUICK_COMMANDS = ["PING", "STATUS", "HW_REV", "VERSION", "HELLO"];
const PRESET_KEY = "sf-device-presets";

type SavedPreset = { name: string; baud: number };
type LibraryEntry = { id: number; title: string; game: string };
type LogEntry = { t: string; text: string; kind: "in" | "out" | "hex" | "sys" | "err" };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

export default function DevicePage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [baud, setBaud] = useState(115200);
  const [sendText, setSendText] = useState("");
  const [portInfo, setPortInfo] = useState<{ vendorId?: number; productId?: number } | null>(null);
  const [showHex, setShowHex] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [previewId, setPreviewId] = useState("");
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => setLibrary(data.scripts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!previewId) {
      setPreviewBody(null);
      return;
    }
    fetch(`/api/scripts/${previewId}`)
      .then((r) => r.json())
      .then((data) => setPreviewBody(data?.script?.body ?? null))
      .catch(() => setPreviewBody(null));
  }, [previewId]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  function timestamp() {
    const d = new Date();
    return d.toLocaleTimeString("en-GB", { hour12: false });
  }

  function appendLog(text: string, kind: LogEntry["kind"]) {
    setLog((prev) => [...prev.slice(-200), { t: timestamp(), text, kind }]);
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = [...presets.filter((p) => p.name !== name), { name, baud }];
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    setPresetName("");
    appendLog(`Preset "${name}" saved (${baud} baud).`, "sys");
  }

  function deletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    appendLog(`Preset "${name}" deleted.`, "sys");
  }

  async function connect() {
    if (!("serial" in navigator)) {
      appendLog("Web Serial isn't supported in this browser. Try Chrome or Edge.", "err");
      return;
    }
    setConnecting(true);
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      setConnected(true);
      setPortInfo(port.getInfo?.() ?? null);
      appendLog(`Connected at ${baud} baud.`, "sys");

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      readLoop(reader);
    } catch (err: any) {
      appendLog(`Connect failed: ${err?.message ?? err}`, "err");
    } finally {
      setConnecting(false);
    }
  }

  async function readLoop(reader: any) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          appendLog(value, "in");
          if (showHex) appendLog(`→ ${toHex(new TextEncoder().encode(value))}`, "hex");
        }
      }
    } catch (err: any) {
      appendLog(`Read error: ${err?.message ?? err}`, "err");
    }
  }

  async function sendLine(text: string) {
    const port = portRef.current;
    if (!port?.writable || !text.trim()) return;
    const writer = port.writable.getWriter();
    const payload = new TextEncoder().encode(text + "\n");
    await writer.write(payload);
    writer.releaseLock();
    appendLog(`> ${text}`, "out");
    if (showHex) appendLog(`→ ${toHex(payload)}`, "hex");
    setSendText("");
  }

  async function disconnect() {
    try {
      await readerRef.current?.cancel();
      await portRef.current?.close();
    } catch {}
    setConnected(false);
    setPortInfo(null);
    appendLog("Disconnected.", "sys");
  }

  function clearLog() {
    setLog([]);
  }

  return (
    <div>
      <div className="page-head">
        <p className="eyebrow">Device</p>
        <h1>Command console</h1>
      </div>
      <p className="lede">
        Uses the browser&apos;s Web Serial API to talk to a USB-connected device — no
        native app or driver install needed. Works in Chrome/Edge over HTTPS (or localhost).
      </p>

      <div className="card deck">
        <div className="conn-bar">
          <span className={`status${connecting ? " is-connecting" : ""}`}>
            <span className={`led${connected ? " on" : ""}${connecting ? " blink" : ""}`} />
            {connecting ? "Connecting…" : connected ? "Connected" : "Not connected"}
            {connected && portInfo && (
              <span className="port-info">
                v{portInfo.vendorId?.toString(16) ?? "NA"}:p{portInfo.productId?.toString(16) ?? "NA"} @{baud}
              </span>
            )}
          </span>
          <div className="panel-actions">
            {!connected ? (
              <>
                <label className="baud-field">
                  <span>Baud rate</span>
                  <select
                    value={baud}
                    onChange={(e) => setBaud(Number(e.target.value))}
                    disabled={connecting}
                    aria-label="Baud rate"
                  >
                    {BAUD_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-teal" onClick={connect} disabled={connecting}>
                  {connecting ? "Connecting…" : "Connect device"}
                </button>
              </>
            ) : (
              <button className="btn-ghost" onClick={disconnect}>Disconnect</button>
            )}
          </div>
        </div>

        <div className="deck-grid">
          <div className="deck-col">
            <h3 className="group-label">Quick commands</h3>
            <div className="quick-chips">
              {QUICK_COMMANDS.map((cmd) => (
                <button key={cmd} className="cmd-chip" disabled={!connected} onClick={() => sendLine(cmd)}>
                  {cmd}
                </button>
              ))}
            </div>

            <h3 className="group-label">Send</h3>
            <form
              className="send-row"
              onSubmit={(e) => {
                e.preventDefault();
                sendLine(sendText);
              }}
            >
              <input
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                placeholder={connected ? "Type a command, press Enter" : "Connect a device to send commands"}
                disabled={!connected}
                aria-label="Command to send"
              />
              <button className="btn-teal" type="submit" disabled={!connected || !sendText.trim()}>
                Send
              </button>
            </form>
            <div className="send-options">
              <label className="toggle">
                <input type="checkbox" checked={showHex} onChange={(e) => setShowHex(e.target.checked)} />
                <span>Hex log</span>
              </label>
              <button type="button" className="btn-ghost btn-small" onClick={clearLog}>
                Clear log
              </button>
            </div>
          </div>

          <div className="deck-col">
            <h3 className="group-label">Slot map</h3>
            <div className="slot-rack">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className={`slot-chip${connected ? " is-link" : ""}`} key={i}>
                  <span className="slot-num">{String(i + 1).padStart(2, "0")}</span>
                  <small>{connected ? "linked" : "empty"}</small>
                </div>
              ))}
            </div>
            <p className="slot-hint">Slots activate when a device is connected.</p>
          </div>
        </div>

        <h3 className="group-label">Presets</h3>
        <div className="presets preset-row">
          <label className="preset-save">
            <span className="sr-only">Preset name</span>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Cronus at home"
              className="preset-input"
            />
            <button type="button" className="btn-ghost btn-small" onClick={savePreset} disabled={!presetName.trim()}>
              Save
            </button>
          </label>
          {presets.map((p) => (
            <span key={p.name} className="preset-chip">
              {p.name}@{p.baud}
              <button type="button" className="linklike" onClick={() => setBaud(p.baud)} aria-label={`Load preset ${p.name} at ${p.baud} baud`}>
                load
              </button>
              <button type="button" className="linklike linklike-danger" onClick={() => deletePreset(p.name)} aria-label={`Delete preset ${p.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="terminal">
        <div className="terminal-bar">
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-title">device — serial output</span>
        </div>
        <div className="log" ref={logRef}>
          {log.length === 0 ? (
            <div className="log-empty">// no output yet</div>
          ) : (
            log.map((entry, i) => (
              <div className={`log-line k-${entry.kind}`} key={i}>
                <span className="log-time">[{entry.t}]</span>
                <span className="log-text">{entry.text}</span>
              </div>
            ))
          )}
        </div>
        <div className="scanlines" />
      </div>

      <section className="section" style={{ marginTop: "2.5rem" }}>
        <h2>Flow preview</h2>
        <p className="lede">
          Run any library script through the step simulator before wiring it to a device.
        </p>
        <div className="send-row" style={{ maxWidth: 420 }}>
          <select
            value={previewId}
            onChange={(e) => setPreviewId(e.target.value)}
            aria-label="Script to preview"
          >
            <option value="">Choose a script…</option>
            {library.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.game})
              </option>
            ))}
          </select>
        </div>
        {previewId && previewBody !== null && <ScriptPreview body={previewBody} />}
        {previewId && previewBody === null && (
          <div className="preview-empty">Couldn&apos;t load that script for preview.</div>
        )}
      </section>
    </div>
  );
}