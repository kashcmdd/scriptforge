export default function Home() {
  return (
    <div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">ScriptForge Hub</p>
          <h1>
            Load it up. <span className="hero-accent">Play it out.</span>
          </h1>
          <p className="lede">
            Your own controller-script hub — accounts, a script library, and a live
            device connection, all running in the browser.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/scripts">Browse the library</a>
            <a className="btn btn-ghost" href="/device">Connect a device</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-head">
            <span className="panel-title">Loadout</span>
            <span className="panel-live"><i /> 8 slots</span>
          </div>
          <div className="slot-rack">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="slot-chip" key={i}>
                <span className="slot-num">{String(i + 1).padStart(2, "0")}</span>
                <small>empty</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-rule" />

      <section className="feature-grid">
        <div className="feature">
          <span className="feature-icon">01</span>
          <h3>Secure accounts</h3>
          <p>Hashed passwords and JWT session cookies — no third-party auth required.</p>
        </div>
        <div className="feature">
          <span className="feature-icon">02</span>
          <h3>Script library</h3>
          <p>SQLite-backed scripts, color-tagged by game, ready to download after login.</p>
        </div>
        <div className="feature">
          <span className="feature-icon">03</span>
          <h3>Device connect</h3>
          <p>Web Serial API — plug a controller in over USB straight from the browser.</p>
        </div>
      </section>
    </div>
  );
}