// Supabase Edge Function "app-chat": the AI side of the test app's "Ideas and fixes" chat,
// and (mode "assistant") of "Do it by chat", where Claude picks app actions that the page confirms and runs.
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

// ---------- "Do it by chat" (mode: "assistant") ----------
// Claude picks app actions; the page runs them on its own data and shows a confirm card before any save.
// The tools only describe actions. Nothing here touches resident records: the page sends back what each action returned.
const MGR = ["manager", "owner", "multi"];
const ALL = ["caregiver", "manager", "rn", "owner", "multi", "family"];
const STAFF = ["caregiver", "manager", "rn", "owner", "multi"];
const date = (d: string) => ({ type: "string", description: d + " As YYYY-MM-DD." });
const time = (d: string) => ({ type: "string", description: d + " 24-hour HH:MM." });
const str = (d: string) => ({ type: "string", description: d });
// deno-lint-ignore no-explicit-any
const ASSIST_TOOLS: { tiers: string[]; perm?: string; tool: any }[] = [
  { tiers: ALL, tool: { name: "whats_due", description: "List what is due or coming up at this home: reports to review, RN delegation checks, training catch-up, rule changes, appointments, on-call check, schedule requests and cleaning jobs.", input_schema: { type: "object", properties: { days: { type: "integer", description: "How many days ahead, 1 to 31. Default 7." } } } } },
  { tiers: STAFF, tool: { name: "get_schedule", description: "Read the schedule for a date range (at most 14 days) at this home, with who is on call each day. Each shift line ends with [shift ID] for assign_shift. Use person 'me' for the person chatting.", input_schema: { type: "object", properties: { from: date("First day."), to: date("Last day. Omit for one day."), person: str("Only this staff member, or 'me'. Omit for everyone."), only_open: { type: "boolean", description: "Only shifts with no one assigned." } }, required: ["from"] } } },
  { tiers: STAFF, tool: { name: "pending_requests", description: "List schedule requests waiting for approval (time off, swaps, pick-ups). Managers see all; staff see their own. Each line ends with [request ID].", input_schema: { type: "object", properties: {} } } },
  { tiers: MGR, tool: { name: "reports_waiting", description: "List incident and other reports waiting for manager review at this home.", input_schema: { type: "object", properties: {} } } },
  { tiers: ALL, tool: { name: "find_procedure", description: "Look up the app's answer to a procedure or rule question (Wisconsin DHS 88 for adult family homes, DHS 83 for CBRFs). Use for any 'can I / how do I / what do we do when' question. Quote the answer and its source; never invent rules.", input_schema: { type: "object", properties: { question: str("The question in the person's words.") }, required: ["question"] } } },
  { tiers: ALL, tool: { name: "list_residents", description: "List resident codes at this home (sample data).", input_schema: { type: "object", properties: {} } } },
  { tiers: STAFF, tool: { name: "list_staff", description: "List staff names at this home.", input_schema: { type: "object", properties: {} } } },
  { tiers: ALL, tool: { name: "open_screen", description: "Show the person buttons that open a screen, service or resident page of the app. Use when they want to go somewhere, ask where something is (for example where to add policies), or the job needs the full screen.", input_schema: { type: "object", properties: { screen: str("A screen id from the list in the context (e.g. schedule, setup, procedures, vendors, outside), or words to search for, e.g. 'fax inbox', 'face sheet M-1', 'add policies'. Typos are fine.") }, required: ["screen"] } } },
  { tiers: MGR, perm: "sched.edit", tool: { name: "add_shift", description: "Add a shift to the schedule. The person sees a confirm card with any staffing, overtime, rest or training problems before it is saved.", input_schema: { type: "object", properties: { person: str("Staff name exactly as listed, or omit for an open shift."), date: date("Shift day (the day it starts)."), start: time("Start."), end: time("End; earlier than start means it ends the next day."), note: str("Optional short note.") }, required: ["date", "start", "end"] } } },
  { tiers: MGR, perm: "sched.edit", tool: { name: "assign_shift", description: "Give an existing shift to someone, or make it open. Get the shift ID from get_schedule first. Shows a confirm card.", input_schema: { type: "object", properties: { shift_id: str("From get_schedule."), person: str("Staff name, or 'open' to leave it open.") }, required: ["shift_id", "person"] } } },
  { tiers: ["caregiver", "manager", "rn"], tool: { name: "request_time_off", description: "Send a time-off request to the manager for the person chatting (managers may name a staff member). Shows a confirm card.", input_schema: { type: "object", properties: { from: date("First day off."), to: date("Last day off. Omit for one day."), kind: { type: "string", enum: ["PTO", "Unpaid", "Other"] }, note: str("Optional note to the manager."), person: str("Managers only: who it is for.") }, required: ["from"] } } },
  { tiers: MGR, perm: "sched.approve", tool: { name: "decide_request", description: "Approve or decline a waiting schedule request. Get the request ID from pending_requests first. Shows a confirm card with any problems approving would cause.", input_schema: { type: "object", properties: { request_id: str("From pending_requests."), decision: { type: "string", enum: ["Approved", "Declined"] }, reply: str("Optional short, kind reply to the staff member.") }, required: ["request_id", "decision"] } } },
  { tiers: MGR, perm: "sched.edit", tool: { name: "set_on_call", description: "Set who answers night help calls, for one date or as the usual person. Shows a confirm card.", input_schema: { type: "object", properties: { person: str("Staff name, 'Manager' or 'On-call RN'."), date: date("One day. Omit to change the usual on-call person.") }, required: ["person"] } } },
  { tiers: ALL, tool: { name: "log_incident", description: "Write an incident or event report (fall, injury, behavior, medication error, elopement, etc.) and send it to the manager's review list. The app rewrites it in professional, factual, non-blaming wording, checks for mandatory-report triggers, and shows it in an editable confirm card. Ask briefly for missing facts (what was seen, what staff did, who was told and when) unless the person wants to send it as is.", input_schema: { type: "object", properties: { resident: str("Resident code like M-2, a nickname, or 'room 2'. Omit if no resident was involved."), what_happened: str("Observed facts in the person's words."), when: str("When it happened, ISO date-time. Omit for now."), where: str("Where it happened."), people_present: str("Roles of people there (no names)."), what_you_did: str("What staff did."), who_you_told: str("Who was told and when.") }, required: ["what_happened"] } } },
  { tiers: ["caregiver", "manager", "rn", "family"], tool: { name: "log_meal", description: "Save how much a resident ate at a meal. Shows a confirm card.", input_schema: { type: "object", properties: { resident: str("Resident code, nickname or 'room N'."), meal: { type: "string", enum: ["breakfast", "lunch", "supper"] }, percent_eaten: { type: "integer", description: "0, 25, 50, 75 or 100." }, refused: { type: "boolean" }, fluids_ml: { type: "integer" }, substitute: str("Anything offered instead."), note: str("Short note."), date: date("Omit for today.") }, required: ["resident", "meal"] } } },
  { tiers: ["caregiver", "manager"], tool: { name: "clock", description: "Clock the person chatting in or out, or start or end a break, on their time sheet. Shows a confirm card.", input_schema: { type: "object", properties: { action: { type: "string", enum: ["in", "out", "break", "back"] } }, required: ["action"] } } },
  { tiers: ALL, tool: { name: "log_question", description: "Send a question with no answer on file to the manager's question log (no name attached). Shows a confirm card.", input_schema: { type: "object", properties: { question: str("The question.") }, required: ["question"] } } },
];
const ASSIST_NAMES = new Set(ASSIST_TOOLS.map((t) => t.tool.name));

const ASSIST_SYSTEM = `You are the "Do it by chat" assistant inside the private test version of Steady Shift, an app for Wisconsin adult family homes (DHS 88), CBRFs (DHS 83) and family caregivers. Staff, managers, nurses and owners type what they need and you do it with the tools, which are the app's own actions.

How to work:
- Use the tools. Don't describe screens when a tool can do the job. For "what's due", schedules, requests, reports and rule questions, call the read tool and answer from its result.
- Write tools (add_shift, assign_shift, request_time_off, decide_request, set_on_call, log_incident, log_meal, clock, log_question) never save by themselves: the app shows the person a confirm card and they tap yes or no. Call the tool once you have what it needs; don't ask "shall I?" first, because the card is the question. If the result says they cancelled, accept it and ask what they'd like instead.
- Resolve dates yourself from today's date and weekday in the context ("Tuesday" means the next Tuesday, today counts). Times: "7-3" is 07:00 to 15:00, "3-11" is 15:00 to 23:00, "11-7" is 23:00 to 07:00, "6-6" is 06:00 to 18:00 unless they say night.
- Use staff names exactly as listed in the context. If a name isn't on the list, say so and list who is; don't guess.
- If a tool says the person's role can't do something, explain kindly and suggest asking their manager. Never try to work around roles.
- For reports, keep the person's facts; the app does the professional rewrite. Never add facts. If key facts are missing (what staff did, who was told), ask in one short question, unless they want to send it now.
- If someone could be hurt right now, tell them to make everyone safe and call 911 or their on-call first, before anything else.
- Rule answers come only from find_procedure. If it has no answer, offer log_question. This is not legal or medical advice.
- Privacy: this is a test version with made-up residents (codes like M-2). If someone types what looks like a real person's name with health details, a date of birth or an ID number, remind them to use sample residents, and keep those details out of tool calls.
- Where things are: a manager adds the home's policies, procedures and handbook in Facility setup and policy upload (screen setup, step 2, PDF or Word), and maps procedures to situations in Policies and procedures (screen procedures). Staff search them in Ask our policy (askpolicy). For any "where is" or "take me to" question, use open_screen with the person's words.
- Replies: warm, plain and short, one to three sentences, no headings or tables. The app already shows tool results as cards, so don't repeat long lists; summarize the important part.`;

// deno-lint-ignore no-explicit-any
function cleanAssistMessages(raw: any): any[] {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  if (!Array.isArray(raw)) return out;
  for (const m of raw.slice(-40)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    if (typeof m.content === "string") {
      const t = m.content.trim().slice(0, 4000);
      if (t) out.push({ role: m.role, content: t });
      continue;
    }
    if (!Array.isArray(m.content)) continue;
    // deno-lint-ignore no-explicit-any
    const blocks: any[] = [];
    for (const b of m.content.slice(0, 24)) {
      if (!b || typeof b !== "object") continue;
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) blocks.push({ type: "text", text: b.text.slice(0, 4000) });
      else if (m.role === "assistant" && b.type === "thinking" && typeof b.thinking === "string" && typeof b.signature === "string") blocks.push({ type: "thinking", thinking: b.thinking, signature: b.signature });
      else if (m.role === "assistant" && b.type === "redacted_thinking" && typeof b.data === "string") blocks.push({ type: "redacted_thinking", data: b.data });
      else if (m.role === "assistant" && b.type === "tool_use" && typeof b.id === "string" && ASSIST_NAMES.has(b.name) && b.input && typeof b.input === "object" && JSON.stringify(b.input).length < 6000) blocks.push({ type: "tool_use", id: b.id.slice(0, 120), name: b.name, input: b.input });
      else if (m.role === "user" && b.type === "tool_result" && typeof b.tool_use_id === "string") blocks.push({ type: "tool_result", tool_use_id: b.tool_use_id.slice(0, 120), content: String(b.content ?? "").slice(0, 6000), is_error: !!b.is_error });
    }
    if (blocks.length) out.push({ role: m.role, content: blocks });
  }
  while (out.length && !(out[0].role === "user" && typeof out[0].content === "string")) out.shift();
  return out;
}

// deno-lint-ignore no-explicit-any
async function assistant(client: Anthropic, body: any) {
  const messages = cleanAssistMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "no-message" }, 400);
  const c = body.context ?? {};
  const s = (v: unknown, n = 80) => String(v ?? "").slice(0, n);
  const list = (v: unknown, n = 40) => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, 60)) : []);
  const tier = ALL.includes(c.tier) ? c.tier : "caregiver";
  // The page decides what is allowed (role, shared permissions, services on). The server only narrows that list
  // to the tools that role could ever have, plus the shared-permission tools the page says were shared.
  const offered = new Set(list(c.tools, 30));
  const tools = ASSIST_TOOLS.filter((t) => offered.has(t.tool.name) && (t.tiers.includes(tier) || !!t.perm)).map((t) => t.tool);
  const ctx = `Context right now: today is ${s(c.weekday, 12)} ${s(c.today, 10)}, ${s(c.time, 5)} (Central time). The person is viewing as ${s(c.tierName, 40)} at "${s(c.site, 60)}" (${s(c.setting, 8)}). Their name on the schedule: ${s(c.me, 40)}.
Staff here: ${list(c.staff).join(", ") || "(not shown for this role)"}.
Resident codes here (sample): ${list(c.residents).join(", ") || "none"}.
Screens: ${list(c.screens, 60).join(", ")}.
Actions this person may use: ${tools.map((t) => t.name).join(", ") || "none"}. If they ask for something else, say their role can't do it here.`;
  const params = {
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: ASSIST_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: ctx },
    ],
    tools,
    messages,
  };
  // deno-lint-ignore no-explicit-any
  const res = await client.beta.messages.create(params as any);
  if (res.stop_reason === "refusal") return json({ content: [{ type: "text", text: "Sorry, I can't help with that one. Could you put it another way?" }], stop_reason: "end_turn" });
  // deno-lint-ignore no-explicit-any
  const content = (res.content as any[]).filter((b) => ["text", "tool_use", "thinking", "redacted_thinking"].includes(b.type));
  return json({ content, stop_reason: res.stop_reason });
}

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

  // deno-lint-ignore no-explicit-any
  let body: { ping?: boolean; mode?: string; messages?: any[]; context?: Record<string, any> };
  try { body = await req.json(); } catch { return json({ error: "bad-json" }, 400); }
  if (body.ping) return json({ ok: !!apiKey });
  if (!apiKey) return json({ error: "not-configured" }, 503);

  if (body.mode === "assistant") {
    try {
      return await assistant(new Anthropic({ apiKey }), body);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
      if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad-key" }, 503);
      if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
      return json({ error: "server" }, 500);
    }
  }

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
