import "./globals.css";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "ScriptForge",
  description: "Your own controller-script hub — accounts, script library, and Web Serial device connect.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="brand">
            <span className="brand-mark">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h10M4 18h7" stroke="#120B18" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </span>
            ScriptForge
          </a>
          <div className="links">
            <a href="/scripts">Scripts</a>
            <a href="/device">Device</a>
            {session ? (
              <a href="/account">Account</a>
            ) : (
              <>
                <a href="/login">Login</a>
                <a href="/signup" className="cta">Sign up</a>
              </>
            )}
          </div>
        </nav>
        <main>{children}</main>
        <footer>
          <span>© 2026 ScriptForge — your controller-script hub.</span>
          <div className="footer-links">
            <a href="/scripts">Scripts</a>
            <a href="/device">Device</a>
            <a href="/login">Login</a>
          </div>
        </footer>
      </body>
    </html>
  );
}