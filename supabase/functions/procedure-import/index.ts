// Supabase Edge Function "procedure-import": AI-assisted mapping of a company's own procedures
// (handbooks, policies, HR documents) onto the Steady Shift what-if scenarios.
// The AI only maps and extracts. The app compares the result with the legal baseline in code,
// so a model mistake can never mark a procedure as compliant.
// The Anthropic API key lives only here, as the secret ANTHROPIC_API_KEY. Never put it in the repo or the page.
// No PHI: the page removes phone numbers, emails, ID numbers, birth dates and passwords before sending,
// and the model is told to leave out any person's name or health detail. Do not send real resident records
// until the HIPAA foundation (BAA with the AI vendor and with Supabase) is in place.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("IMPORT_MODEL") ?? Deno.env.get("CHAT_MODEL") ?? "claude-opus-5-5";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blessedfig.github.io";
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You map a care company's own written procedures onto a fixed library of "what-if" scenarios for Wisconsin adult family homes (DHS 88) and CBRFs (DHS 83).

You get: the company's document text, the scenario catalog (id, title, notify_keys), and the list of notify keys.

Do this:
- Find each passage that tells staff what to do in one of the catalog's situations. Map it to the single best scenario id. Use only ids from the catalog.
- For each mapped passage, give the role it is written for (caregiver, manager, owner, or "" if unclear), the steps in short plain sentences in the company's meaning (do not add steps they didn't write), and every "who to notify" it states, using only the given notify keys, with within_hours as a number when the text gives a time (immediately = 0, next business day = 24, 3 days = 72, 7 days = 168) or null when it gives none.
- Copy a short quote (under 200 characters) of the passage so a person can check your mapping.
- confidence: high when the passage clearly covers the scenario, medium when partly, low when it's a guess.
- List passages that look like procedures but match no scenario in "unmapped" as short summaries.
- Never judge legality. Never invent times. Never include a person's name, phone number, health detail, password or other private detail; replace with a role word ("the resident", "the manager").
Call the record_mapping tool exactly once.`;

const TOOL = {
  name: "record_mapping",
  description: "Record the mapping of the company's procedures to scenario ids.",
  strict: true,
  input_schema: {
    type: "object", additionalProperties: false, required: ["procedures", "unmapped"],
    properties: {
      procedures: { type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["scenario_id", "role", "steps", "notify", "quote", "confidence"],
        properties: {
          scenario_id: { type: "string" },
          role: { type: "string", enum: ["caregiver", "manager", "owner", ""] },
          steps: { type: "array", items: { type: "string" } },
          notify: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "within_hours", "text"],
            properties: { key: { type: "string" }, within_hours: { type: ["number", "null"] }, text: { type: "string" } } } },
          quote: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        } } },
      unmapped: { type: "array", items: { type: "string" } },
    },
  },
};

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
  const text = String(body.text ?? "").slice(0, 60000);
  const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 300) : [];
  if (!text.trim() || !catalog.length) return json({ error: "no-input" }, 400);
  const ids = new Set(catalog.map((c: { id: string }) => c.id));
  const keys = body.keys && typeof body.keys === "object" ? body.keys : {};

  const client = new Anthropic({ apiKey });
  try {
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Scenario catalog:\n" + JSON.stringify(catalog) + "\n\nNotify keys:\n" + JSON.stringify(keys), cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_mapping" },
      messages: [{ role: "user", content: `Document "${String(body.source ?? "").slice(0, 120)}":\n\n${text}` }],
    };
    const res = await client.beta.messages.create(params);
    if (res.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const call = res.content.find((b) => b.type === "tool_use");
    if (!call) return json({ error: "no-mapping" }, 502);
    // deno-lint-ignore no-explicit-any
    const out = (call as any).input as { procedures: any[]; unmapped: string[] };
    const procedures = (out.procedures ?? []).filter((p) => ids.has(p.scenario_id))
      .map((p) => ({ ...p, notify: (p.notify ?? []).filter((n: { key: string }) => n.key in keys) }));
    return json({ procedures, unmapped: out.unmapped ?? [] });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad-key" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
    return json({ error: "server" }, 500);
  }
});
