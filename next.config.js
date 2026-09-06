/** @type {import('next').NextConfig} */
// Dev-only carve-out: Next's dev runtime hydrates via eval()/new Function(),
// so 'unsafe-eval' is required locally. Production builds are strict.
const scriptSrc = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const CSP = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;