# procedure-import (AI-assisted company procedure import)

Server function behind **Company procedures** in `/app`. A company pastes or uploads its own procedures, handbook or HR policy text. Claude maps each passage to a what-if scenario and pulls out "who to notify, by when". The app then compares those times with the legal baseline in `data/scenarios/wi.json` and flags anything that falls below it. The AI never decides what is legal; the comparison is plain code.

Until this function is deployed with a key, the page uses a keyword matcher, and structured files (the CSV or JSON templates in `data/scenarios/`) import exactly. Nothing breaks without it.

## Turn it on

Same steps as `../app-chat/README.md`, with the function name `procedure-import`. It uses the same `ANTHROPIC_API_KEY` secret, so if the chat helper is already on, only step 3 (deploy) is needed. Leave "Verify JWT" on.

Optional secret `IMPORT_MODEL` (defaults to `CHAT_MODEL`, then `claude-opus-5-5`). A 20-page handbook is roughly 15 to 25 cents per import with the default model.

## Privacy

- Only signed-in Owner Desk members can call it.
- The page removes phone numbers, emails, ID numbers, birth dates and passwords before sending. The model is told to leave out names and health details.
- Procedures and handbooks are company documents, not resident records. Do not upload resident records until the HIPAA foundation (signed BAAs with the AI vendor and Supabase) is in place.
- Mapped results are saved only in the browser in this test version. A production version would store them per organization with row-level security.
