# app-chat (AI helper for the test app)

Two jobs: the "Ideas and fixes" chat (below), and "Do it by chat" (`#/assistant`), sent with `mode: "assistant"`. In that mode Claude only chooses actions from a fixed list (look up the schedule, add a shift, write a report, and so on). The page runs them on its own data, shows a confirm card before anything is saved, and sends back the result. The page tells the function which actions the person's role may use, and the function offers Claude only those. Without the API key, the page uses its built-in command reader instead.

**After changing this file, redeploy it** (Edge Functions > app-chat > Code, paste `index.ts`, Deploy).

Server function behind the "Ideas and fixes" chat in `/app`. When it is deployed and has an API key, the chat talks with Claude, asks follow-up questions, and saves confirmed ideas to the desk's Requests for Claude (`source: test-app-ai-chat`). Until then, the app uses its scripted helper, so nothing breaks.

The API key is stored only as a Supabase secret. It is never in this repo or the web page.

## Turn it on (about 10 minutes, done once)

1. **Create the API key.** Sign in at https://console.anthropic.com, add a payment method, and create an API key (Settings > API keys). Copy it.
2. **Set a spending cap.** In the Console under Settings > Limits, set a monthly spend limit (for example $20). The function also uses low effort and short replies to keep cost down.
3. **Deploy the function.** In Supabase, open project "owner-desk" > Edge Functions > Deploy a new function > Via editor. Name it exactly `app-chat`, replace the sample code with the contents of `index.ts` in this folder, and deploy. Leave "Verify JWT" on.
4. **Add the key.** Edge Functions > Secrets > Add new secret: name `ANTHROPIC_API_KEY`, value = the key from step 1. Save.
5. **Check it.** Open https://blessedfig.github.io/steady-shift/app/, reload, and open "Ideas and fixes". The greeting starts "Hi! I'm the app's helper" when AI is on.

## Settings (optional secrets)

- `CHAT_MODEL`: defaults to `claude-opus-5-5`. Set `claude-haiku-5-5` for a much cheaper, simpler helper.
- `ALLOWED_ORIGIN`: defaults to `https://blessedfig.github.io`.

## Cost, roughly

With the default model, one chat reply is about 1 to 2 cents (cached instructions plus a short answer). A hundred replies a month is about $1 to $2. Check actual usage in the Anthropic Console.

## Turn it off

Delete the `ANTHROPIC_API_KEY` secret (or the function). The chat falls back to the scripted helper.

## Privacy

Only signed-in Owner Desk members can use it. The helper is told never to save resident names or health details. Messages go to Anthropic's API to get a reply; do not type real resident information.
