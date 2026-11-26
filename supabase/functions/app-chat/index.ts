// Supabase Edge Function "app-chat": the AI side of the test app's "Ideas and fixes" chat.
// The Anthropic API key lives only here, as the secret ANTHROPIC_API_KEY. Never put it in the repo or the page.
// Only signed-in Owner Desk members can use it (checked with the database's is_desk_member rule).
// Cost control: set a monthly spend limit on the Anthropic Console for the key's workspace.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("CHAT_MODEL") ?? "claude-opus-5-5";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blessedfig.github.io";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are the feedback assistant inside the private test version of "Steady Shift" (working name), an app for Wisconsin adult family homes (AFH, DHS 88), CBRFs (DHS 83), home care and family caregivers. The person chatting is usually Angelika, the founder (a former AFH manager and CNA), or Christian, who builds it with Claude.

Your job: help them turn ideas into clear, actionable requests for changing the app or the public website, then save each one with the save_request tool.

How to talk:
- Warm, plain, brief. Two to four short sentences per reply. No jargon, no markdown headings.
- Ask one follow-up question at a time, only when it matters: which screen or page, what exactly should change, why it matters on a real shift, and how soon. Skip what they already told you.
- When you have enough to act on, summarize it in one or two sentences and ask "Shall I send that to the desk?" Call save_request only after they say yes (or clearly ask you to send it). One request per idea; if they gave several ideas, save each separately.
- After saving, say it's on the Owner Desk under Requests for Claude, and ask if there's anything else.
- You can answer questions about what the app does (below). You cannot change the app yourself; Christian and Claude make the changes from the desk.
- Never ask for, repeat or save real resident names, health details, dates of birth or other private information. If they include any, gently remind them to use made-up examples, and leave those details out of the saved request.
- This is not legal or medical advice. For rule questions, point to the Clarity Card in the app or suggest Ask the Regulator, and offer to log the question.

What the test app has: a "View as" switcher (caregiver, house manager, RN, owner, multi-site operator, family caregiver) and a "Home" switcher with sample homes; Procedure check; Write a report (casual note to professional report, templated); Night help triage; Behavior help; Clarity Cards; Survey-Ready Check; Decide and Document; Ask the Regulator; Regulatory Watch; Reports to review; Question log; Team training; RN delegation ledger; Owner view with a money estimate; All sites with policy push; Hand-off packet. All data is fictional and stays in the browser. The public website has buyer paths for caregivers, family caregivers, AFHs, CBRFs, home care agencies and multi-site operators, draft plan prices, and a sample demo.`;

const TOOLS = [{
  name: "save_request",
  description: "Save one confirmed idea or fix to the Owner Desk's Requests for Claude. Call only after the person agreed to send it.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "where", "what", "why", "when"],
    properties: {
      kind: { type: "string", enum: ["Suggestion", "Update", "Action to take", "Question"], description: "Suggestion = new idea; Update = wording or content change; Action to take = something broken; Question = needs an answer" },
      where: { type: "string", description: "Screen name, 'Whole app', or 'Public website' plus the section" },
      what: { type: "string", description: "The change, in clear plain words, with no private resident details" },
      why: { type: "string", description: "Why it matters, or an empty string if not given" },
      when: { type: "string", enum: ["Whenever", "This week", "Urgent"] },
    },
  },
}];

type Turn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await db.auth.getUser();
  const email = userData?.user?.email?.toLowerCase();
  if (!email) return json({ error: "signin" }, 401);
  const { data: member } = await db.rpc("is_desk_member");
  if (!member) return json({ error: "not-member" }, 403);

  let body: { ping?: boolean; messages?: Turn[]; context?: Record<string, string> };
  try { body = await req.json(); } catch { return json({ error: "bad-json" }, 400); }
  if (body.ping) return json({ ok: !!apiKey });
  if (!apiKey) return json({ error: "not-configured" }, 503);

  const turns = (body.messages ?? []).slice(-20)
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "no-message" }, 400);

  const ctx = body.context ?? {};
  const where = `Right now they are on the "${String(ctx.screen ?? "").slice(0, 60)}" screen, viewing as ${String(ctx.tier ?? "").slice(0, 40)}, home "${String(ctx.site ?? "").slice(0, 60)}".`;

  const client = new Anthropic({ apiKey });
  // deno-lint-ignore no-explicit-any
  const messages: any[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const saved: string[] = [];

  try {
    for (let i = 0; i < 4; i++) {
      // deno-lint-ignore no-explicit-any
      const params: any = {
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: where },
        ],
        tools: TOOLS,
        messages,
      };
      const res = await client.beta.messages.create(params);
      if (res.stop_reason === "refusal") {
        return json({ reply: "Sorry, I can't help with that one. Could you put it another way?", saved });
      }
      if (res.stop_reason !== "tool_use") {
        const reply = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
        return json({ reply: reply || "Got it. Anything else?", saved });
      }
      messages.push({ role: "assistant", content: res.content });
      // deno-lint-ignore no-explicit-any
      const results: any[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        const inp = b.input as { kind: string; where: string; what: string; why: string; when: string };
        const text = `${inp.what}${inp.why ? "\n\nWhy: " + inp.why : ""}\n\n(Saved by the AI chat in the test app. Screen open: ${ctx.screen ?? ""}, viewing as ${ctx.tier ?? ""})`;
        const { error } = await db.from("desk_items").insert({
          kind: "request",
          data: { kind: inp.kind, biz: inp.where === "Public website" || /website/i.test(inp.where) ? "Website (from test app chat)" : "Test app: " + inp.where, when: inp.when, text, status: "New", reply: "", by: email, source: "test-app-ai-chat" },
        });
        if (error) results.push({ type: "tool_result", tool_use_id: b.id, is_error: true, content: "Could not save: " + error.message });
        else { saved.push(inp.what); results.push({ type: "tool_result", tool_use_id: b.id, content: "Saved to Requests for Claude." }); }
      }
      messages.push({ role: "user", content: results });
    }
    return json({ reply: "Saved. Anything else?", saved });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad-key" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
    return json({ error: "server" }, 500);
  }
});
