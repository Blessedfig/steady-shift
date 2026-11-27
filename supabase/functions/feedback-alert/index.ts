// Supabase Edge Function "feedback-alert": emails the owner when a tester's note lands on the Owner Desk.
// Called by a Database Webhook on INSERT into public.desk_items (Database > Webhooks, type "Supabase Edge
// Functions", which sends the service role key as the Authorization header).
// The function does not trust the webhook body: it re-reads the row by id with the service role, and only
// mails rows that are requests or answers from someone other than the owner, created in the last 10 minutes.
// Follow-up answers in the test app update the same row, so each note is mailed once.
// The email holds a short summary (who, type, screen, first 200 characters) and a link to the desk. Testers are
// asked never to type resident names or health details; this is test data only.
// Secrets (Edge Functions > Secrets): SMTP_PASS (Christian enters it himself; never in the repo or the page).
// Optional: SMTP_HOST (default smtppro.zoho.com), SMTP_PORT (465), SMTP_USER and ALERT_TO (default owner address),
// ALERT_SKIP (comma-separated emails whose own notes are not mailed; default the owner address).
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER = "owner@theblessedfigtree.com";
const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const DESK = "https://blessedfig.github.io/steady-shift/desk/";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // Only the service role (the webhook) may call this.
  const auth = req.headers.get("authorization") ?? "";
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!service || auth !== "Bearer " + service) return json({ error: "forbidden" }, 403);

  let body: { type?: string; table?: string; record?: { id?: string } };
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }
  if (body.type !== "INSERT" || body.table !== "desk_items" || !body.record?.id) return json({ skipped: "not an insert" });

  const sb = createClient(env("SUPABASE_URL"), service, { auth: { persistSession: false } });
  const { data: row, error } = await sb.from("desk_items").select("id, kind, data, created_at").eq("id", body.record.id).maybeSingle();
  if (error) return json({ error: "read" }, 500);
  if (!row) return json({ skipped: "not found" });
  const d = (row.data ?? {}) as Record<string, string>;
  const by = String(d.by ?? "").toLowerCase();
  const skip = env("ALERT_SKIP", OWNER).toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (!["request", "answer"].includes(row.kind)) return json({ skipped: "kind" });
  if (!by || skip.includes(by)) return json({ skipped: "owner or unknown" });
  if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) return json({ skipped: "old" });

  const pass = env("SMTP_PASS");
  if (!pass) return json({ error: "SMTP_PASS not set" }, 500);

  const src = ({ "test-app-chat": "Ideas and fixes chat", "test-app-ai-chat": "AI chat", "test-app-feedback": "Rating or feedback", "test-app-review": "Feedback review" } as Record<string, string>)[d.source] ?? (row.kind === "answer" ? "Answer to a desk question" : "Desk request");
  const text = String(d.text ?? "").split("\n\n(")[0];
  const what = (text.match(/^What: (.*)$/m)?.[1] ?? text).replace(/\s+/g, " ").trim();
  const short = what.length > 200 ? what.slice(0, 197) + "..." : what;
  const lines = [
    `New note from ${by} on the Owner Desk.`,
    "",
    `From: ${src}`,
    d.kind ? `Type: ${d.kind}` : "",
    d.biz ? `About: ${d.biz}` : "",
    d.when && d.when !== "Whenever" ? `How soon: ${d.when}` : "",
    "",
    `"${short}"`,
    "",
    `Open the desk to read it all and reply: ${DESK}`,
    "",
    "Test data only. Testers are asked not to type resident names or health details.",
  ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""));

  const client = new SMTPClient({
    connection: { hostname: env("SMTP_HOST", "smtppro.zoho.com"), port: Number(env("SMTP_PORT", "465")), tls: true, auth: { username: env("SMTP_USER", OWNER), password: pass } },
  });
  try {
    await client.send({
      from: `Steady Shift <${env("SMTP_USER", OWNER)}>`,
      to: env("ALERT_TO", OWNER),
      subject: `New tester note: ${short.slice(0, 60)}${short.length > 60 ? "..." : ""}`,
      content: lines.join("\n"),
      html: lines.map(l => l.startsWith("Open the desk") ? `<p><a href="${DESK}">Open the Owner Desk</a> to read it all and reply.</p>` : l ? `<p>${esc(l)}</p>` : "").join(""),
    });
    await client.close();
  } catch (e) {
    try { await client.close(); } catch { /* ignore */ }
    console.error("send failed", String(e));
    return json({ error: "send" }, 502);
  }
  return json({ sent: true });
});
