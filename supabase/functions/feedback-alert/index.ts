// Supabase Edge Function "feedback-alert": emails the owner when a tester's note lands on the Owner Desk.
// Called by a Database Webhook on INSERT into public.desk_items (Database > Webhooks, type "Supabase Edge
// Functions", which adds a project key as the Authorization header; the gateway verifies it).
// The function does not trust the webhook body: it re-reads the row by id with the service role, and only
// mails rows that are requests or answers from someone other than the owner, created in the last 10 minutes.
// Follow-up answers in the test app update the same row, so each note is mailed once (data.alerted marks it).
// The email holds a short summary (who, type, screen, first 200 characters) and a link to the desk. Testers are
// asked never to type resident names or health details; this is test data only.
// Needs: grant select, update on public.desk_items to service_role (done 2026-11-27).
// Secrets (Edge Functions > Secrets): SMTP_PASS (Christian enters it himself; never in the repo or the page).
// Optional: SMTP_HOST (default smtppro.zoho.com), SMTP_PORT (465), SMTP_USER and ALERT_TO (default owner address),
// ALERT_SKIP (comma-separated emails whose own notes are not mailed; default the owner address).
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER = "owner@theblessedfigtree.com";
const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const DESK = "https://blessedfig.github.io/steady-shift/desk/";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // The gateway checks the JWT ("Verify JWT" on). The body is not trusted: the row is re-read below, only fresh
  // tester rows are mailed, and each row is mailed at most once (data.alerted), so a stray call can't spam.
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!service) return json({ error: "config" }, 500);

  let body: { type?: string; table?: string; record?: { id?: string } };
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }
  if (body.type !== "INSERT" || body.table !== "desk_items" || !body.record?.id) return json({ skipped: "not an insert" });

  const sb = createClient(env("SUPABASE_URL"), service, { auth: { persistSession: false } });
  const { data: row, error } = await sb.from("desk_items").select("id, kind, data, created_at").eq("id", body.record.id).maybeSingle();
  if (error) { console.error("read failed", error.message); return json({ error: "read", detail: error.message }, 500); }
  if (!row) return json({ skipped: "not found" });
  const d = (row.data ?? {}) as Record<string, string>;
  const by = String(d.by ?? "").toLowerCase();
  const skip = env("ALERT_SKIP", OWNER).toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (!["request", "answer"].includes(row.kind)) return json({ skipped: "kind" });
  if (!by || skip.includes(by)) return json({ skipped: "owner or unknown" });
  if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) return json({ skipped: "old" });

  if (d.alerted) return json({ skipped: "already mailed" });
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

  const user = env("SMTP_USER", OWNER);
  const transport = nodemailer.createTransport({ host: env("SMTP_HOST", "smtppro.zoho.com"), port: Number(env("SMTP_PORT", "465")), secure: true, auth: { user, pass: pass.replace(/\s+/g, "") }, name: "theblessedfigtree.com" });
  let stage = "login";
  try {
    await transport.verify();
    stage = "send";
    await transport.sendMail({
      from: `Steady Shift <${user}>`,
      to: env("ALERT_TO", OWNER),
      subject: `New tester note: ${short.slice(0, 60)}${short.length > 60 ? "..." : ""}`,
      text: lines.join("\n"),
      html: lines.map(l => l.startsWith("Open the desk") ? `<p><a href="${DESK}">Open the Owner Desk</a> to read it all and reply.</p>` : l ? `<p>${esc(l)}</p>` : "").join(""),
    });
  } catch (e) {
    console.error("send failed", String(e));
    return json({ error: "send", stage, detail: String(e).slice(0, 300) }, 502);
  }
  await sb.from("desk_items").update({ data: { ...d, alerted: new Date().toISOString() } }).eq("id", row.id);
  return json({ sent: true });
});
