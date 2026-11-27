// Supabase Edge Function "order-mail": reads one fax or email from an outside clinician (doctor, nurse,
// pharmacy, specialist) into proposed order lines for the Steady Shift review queue (#/outside in the test app).
// The AI only proposes. Every line waits for a nurse or manager to approve it in the app; nothing here writes
// to orders, shifts or schedules.
// The Anthropic API key lives only here, as the secret ANTHROPIC_API_KEY. Never put it in the repo or the page.
// PHI: real faxes and emails with orders are protected health information. Until the HIPAA foundation is in
// place (BAAs with Anthropic, Supabase, the fax service and the email provider; audit logging; per-home storage
// with row-level security), send only made-up sample messages. The function refuses messages over 30,000 characters.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("ORDER_MAIL_MODEL") ?? Deno.env.get("CHAT_MODEL") ?? "claude-opus-5-5";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blessedfig.github.io";
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You read one fax or email that an outside clinician (doctor, nurse, pharmacy, therapist, hospice, specialist) sent to a Wisconsin adult family home or CBRF. Staff at the home will turn what you find into shift tasks, but a nurse or manager reviews every line first.

You get: the message, the home's residents (code and first name), the resident's current orders (id, resident, kind, text), and today's date.

Do this:
- Pull out each separate instruction staff must follow: medications, diet, care tasks, monitoring, labs, appointments or visits, and "call if" rules. One line per instruction. Skip greetings, signatures, logistics that need no action, and anything that is not an instruction.
- resident: the code from the list that the message is about (match the code or first name). "" if you cannot tell. Never guess between two residents.
- action: "new", "change" (it replaces or alters a current order), or "stop" (discontinue, hold, no longer). For change and stop, set match_order_id to the current order it affects, or "" if none clearly matches.
- kind: med, diet, activity (care task or therapy), appointment, lab, monitor, or other (call-if rules and standing instructions).
- text: the instruction in short, plain words, faithful to the original. Never change a dose, number, route or time. Never add advice.
- frequency: as written ("daily", "twice a day", "every 2 hours", "weekly", "once"), or "".
- times: 24-hour HH:MM reminder times only when the message implies them (breakfast 08:00, before breakfast 07:30, lunch 12:00, supper 17:30, bedtime 20:30, evening 19:00, every N hours overnight from 22:00 to 06:00). Leave empty for medications (the MAR covers those) and when no time is implied.
- start: YYYY-MM-DD when it starts or is due ("in 3 weeks" counts from the message date). end: YYYY-MM-DD or "".
- track: for monitoring, what staff record: label, type (check, yesno, number, ml, lb, text), freq (each meal, every shift, daily, weekly), where (meal and/or handoff). Otherwise null.
- quote: the exact words from the message (under 200 characters) so a person can check you.
- confidence: high, medium or low. questions: anything a nurse should clarify with the sender (unclear dose, illegible, conflicts with a current order, missing resident).
- Set not_orders true when the message has no clinical instructions, or looks like phishing (asks for resident lists, passwords, payments, or to click a link). Then return no items.
Call the record_lines tool exactly once.`;

const TOOL = {
  name: "record_lines",
  description: "Record the order lines found in the message.",
  strict: true,
  input_schema: {
    type: "object", additionalProperties: false, required: ["items", "not_orders"],
    properties: {
      not_orders: { type: "boolean" },
      items: { type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["resident", "action", "match_order_id", "kind", "text", "frequency", "times", "start", "end", "track", "quote", "confidence", "questions"],
        properties: {
          resident: { type: "string" },
          action: { type: "string", enum: ["new", "change", "stop"] },
          match_order_id: { type: "string" },
          kind: { type: "string", enum: ["med", "diet", "activity", "appointment", "lab", "monitor", "other"] },
          text: { type: "string" },
          frequency: { type: "string" },
          times: { type: "array", items: { type: "string" } },
          start: { type: "string" },
          end: { type: "string" },
          track: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["label", "type", "freq", "where"], properties: {
            label: { type: "string" },
            type: { type: "string", enum: ["check", "yesno", "number", "ml", "lb", "text"] },
            freq: { type: "string", enum: ["each meal", "every shift", "daily", "weekly"] },
            where: { type: "array", items: { type: "string", enum: ["meal", "handoff"] } },
          } }] },
          quote: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          questions: { type: "array", items: { type: "string" } },
        } } },
    },
  },
};

const s = (v: unknown, n: number) => String(v ?? "").slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await db.auth.getUser();
  if (!u?.user?.email) return json({ error: "signin" }, 401);
  const { data: member } = await db.rpc("is_desk_member");
  if (!member) return json({ error: "not-member" }, 403);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad-json" }, 400); }
  if (body.ping) return json({ ok: !!apiKey });
  if (!apiKey) return json({ error: "not-configured" }, 503);
  const m = body.message ?? {};
  const text = String(m.body ?? "");
  if (!text.trim()) return json({ error: "no-input" }, 400);
  if (text.length > 30000) return json({ error: "too-long" }, 413);
  // deno-lint-ignore no-explicit-any
  const residents = (Array.isArray(body.residents) ? body.residents : []).slice(0, 60).map((r: any) => ({ code: s(r.code, 12), nick: s(r.nick, 30) }));
  // deno-lint-ignore no-explicit-any
  const current = (Array.isArray(body.current) ? body.current : []).slice(0, 200).map((o: any) => ({ id: s(o.id, 40), res: s(o.res, 12), kind: s(o.kind, 20), text: s(o.text, 300) }));
  const codes = new Set(residents.map((r: { code: string }) => r.code));
  const ids = new Set(current.map((o: { id: string }) => o.id));
  const today = /^\d{4}-\d\d-\d\d$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);

  const client = new Anthropic({ apiKey });
  try {
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      // A forced tool_choice is rejected by the default model, so use auto (at most one call) and name the tool in the prompt.
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content:
        `Message date: ${today}\nChannel: ${s(m.channel, 10)}\nFrom: ${s(m.from, 120)}, ${s(m.org, 120)}\nSubject: ${s(m.subject, 200)}\n\n<message>\n${text}\n</message>\n\nResidents: ${JSON.stringify(residents)}\nCurrent orders: ${JSON.stringify(current)}` }],
    };
    const res = await client.beta.messages.create(params);
    if (res.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const call = res.content.find((b) => b.type === "tool_use");
    if (!call) return json({ error: "no-lines" }, 502);
    // deno-lint-ignore no-explicit-any
    const out = (call as any).input as { items: any[]; not_orders: boolean };
    const items = (out.items ?? []).map((x) => ({
      ...x,
      resident: codes.has(x.resident) ? x.resident : "",
      match_order_id: ids.has(x.match_order_id) ? x.match_order_id : "",
      times: (x.times ?? []).filter((t: string) => /^\d\d:\d\d$/.test(t)).slice(0, 12),
      start: /^\d{4}-\d\d-\d\d$/.test(x.start) ? x.start : today,
      end: /^\d{4}-\d\d-\d\d$/.test(x.end) ? x.end : "",
    }));
    return json({ items: out.not_orders ? [] : items, not_orders: !!out.not_orders });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad-key" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
    return json({ error: "server" }, 500);
  }
});
