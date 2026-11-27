# facility-ask (grounded answers for "Ask our policy")

Optional. Without it, "Ask our policy" quotes the matching passages from the home's own documents word for word, which is already grounded. With it, Claude rewords those passages into short answers, and every sentence must cite one of them.

How grounding is enforced:

- The function only sees passages from one home and a short law summary. There is no shared knowledge base.
- Any sentence without a valid passage id from this request is dropped in code. If nothing is left, the answer is "Not covered by your policy."
- Conflicts with the law are found by the app's code, not by the AI.

Turn it on like `../app-chat/README.md` (same `ANTHROPIC_API_KEY`), with the function name `facility-ask`. Optional secret `ASK_MODEL`.

## Before real facilities use it (production)

- Store documents and passages in Postgres tables keyed by `org_id` and `facility_id`, with row-level security so a user can read only the facilities they belong to. Files go in a private storage bucket under `<org_id>/<facility_id>/`, with matching storage policies.
- Retrieve passages inside this function with the caller's token (so RLS applies), filtered by `facility_id`. Never accept passages from the browser, and never put two facilities' passages in one prompt.
- If embeddings are added later, they live in the same per-facility table (pgvector) and are queried with the same filter.
- HIPAA-ready before any resident information: a Business Associate Agreement with Supabase (HIPAA add-on) and with the AI provider (zero data retention), audit logging, and a written rule that handbooks are uploaded without resident details.
