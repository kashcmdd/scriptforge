/**
 * Minimal mail sender. Without RESEND_API_KEY set, this just logs the
 * email to the console — fine for local dev, NOT a real delivery
 * mechanism. Set RESEND_API_KEY (and MAIL_FROM) to actually send mail
 * via Resend's API, or swap this out for whatever provider you use.
 */
export async function sendMail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "no-reply@example.com";

  if (!apiKey) {
    console.log(`[mail:dev] To: ${to}\nSubject: ${subject}\n\n${body}\n`);
    return { delivered: false, dev: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text: body }),
  });

  if (!res.ok) {
    console.error("[mail] send failed", await res.text());
    return { delivered: false, dev: false };
  }
  return { delivered: true, dev: false };
}
