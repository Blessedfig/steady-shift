# order-mail (outside faxes and emails into order lines)

Server function behind **Faxes and emails** (`#/outside`) in `/app`. It reads one fax or email from an outside doctor, nurse, pharmacy or specialist and proposes order lines: resident, new/change/stop (matched to a current order), kind, plain instruction, how often, reminder times, start date, what staff record, a quote from the original, and questions for the nurse.

The AI only proposes. The page puts every line in a review queue; a nurse or manager edits and approves each one before it becomes an order, a shift reminder, a manager standard or a calendar date. Without this function the page uses a built-in reader (keyword rules), so nothing breaks.

## Turn it on

Same steps as `../app-chat/README.md`, with the function name `order-mail`. It uses the same `ANTHROPIC_API_KEY` secret. Leave "Verify JWT" on. Optional secret `ORDER_MAIL_MODEL` (defaults to `CHAT_MODEL`, then `claude-opus-5-5`). A one-page fax is a fraction of a cent to about 2 cents with the default model.

## Privacy

- Only signed-in Owner Desk members can call it.
- Real orders are protected health information. Send only made-up sample messages until the HIPAA foundation is in place: BAAs with Anthropic (zero data retention), Supabase, the fax service and the email provider; audit logging; per-home storage with row-level security.
- Later, inbound faxes and emails will reach a separate webhook function (planned, not built), which stores the original PDF in private per-home storage and calls this reader server-side.
