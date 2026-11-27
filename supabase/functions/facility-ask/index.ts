// Supabase Edge Function "facility-ask": grounded wording for "Ask our policy" in the test app.
// Grounding rules, enforced here in code and not only in the prompt:
//  - The model sees only the passages sent for ONE facility plus the law summary. It has no other knowledge base.
//  - Every policy sentence it returns must name a passage id from this request; anything else is dropped.
//  - If nothing it returns is cited, the answer is "not covered by your policy".
// Production must change one thing: retrieve passages here on the server, filtered by the caller's facility_id
// under row-level security, instead of trusting passages sent by the page. See README.md.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("ASK_MODEL") ?? Deno.env.get("CHAT_MODEL") ?? "claude-opus-5-5";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blessedfig.github.io";
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You answer a caregiver's question about ONE care home's own written policy.
You are given numbered passages from that home's documents, and a short summary of the law.
Rules:
- Use only the passages. Do not use outside knowledge about other homes, companies or typical policies.
- Each policy statement must cite exactly one passage id it comes from. Keep the home's meaning; do not add steps.
- If no passage answers the question, set not_covered to true and return no policy statements.
- Do not restate the law; the app shows it. Do not judge legality; the app checks conflicts.
- Plain words, short sentences. Never include names, phone numbers or health details.
Call the answer tool exactly once.`;

const TOOL = {
  name: "answer",
  strict: true,
  description: "Return the grounded answer.",
  input_schema: {
    type: "object", additionalProperties: false, required: ["policy", "not_covered"],
    properties: {
      policy: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "source_id"],
        properties: { text: { type: "string" }, source_id: { type: "string" } } } },
      not_covered: { type: "boolean" },
    },
  },
};

type Passage = { id: string; source: string; text: string };

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

  const question = String(body.question ?? "").slice(0, 500);
  const facility = String(body.facility ?? "");
  const passages: Passage[] = (Array.isArray(body.passages) ? body.passages : []).slice(0, 6)
    .map((p: Record<string, unknown>) => ({ id: String(p.id), source: String(p.source).slice(0, 200), text: String(p.text).slice(0, 1500) }));
  if (!question || !facility || !passages.length) return json({ policy: [], not_covered: true });
  const ids = new Set(passages.map((p) => p.id));
  const law = (Array.isArray(body.law) ? body.law : []).slice(0, 2).map((l: Record<string, unknown>) => String(l.text).slice(0, 1500));

  const client = new Anthropic({ apiKey });
  try {
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      // Claude Opus 5.5 rejects a forced tool_choice ("tool"/"any") with a 400. Use auto (at most one call),
      // keep strict: true on the tool, and name the tool in the prompt.
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{
        role: "user",
        content: `Question: ${question}\n\nLaw summary (context only):\n${law.join("\n") || "(none)"}\n\nPassages from this home's documents:\n` +
          passages.map((p) => `[${p.id}] (${p.source}) ${p.text}`).join("\n\n"),
      }],
    };
    const res = await client.beta.messages.create(params);
    if (res.stop_reason === "refusal") return json({ policy: [], not_covered: true });
    const call = res.content.find((b) => b.type === "tool_use");
    // deno-lint-ignore no-explicit-any
    const out = (call as any)?.input ?? { policy: [], not_covered: true };
    // Drop anything not tied to a passage from this request.
    const policy = (out.policy ?? []).filter((p: { source_id: string; text: string }) => ids.has(p.source_id) && p.text?.trim()).slice(0, 6);
    return json({ policy, not_covered: policy.length === 0 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
    return json({ error: "server" }, 500);
  }
});
