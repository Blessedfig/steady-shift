# What-if scenario library (data)

Machine-readable "what do I do if...?" scenarios for adult family homes and CBRFs, starting with Wisconsin. The test app's **What-if library** and **Company procedures** screens load these files. Not legal advice.

| File | What it is |
| --- | --- |
| `wi.json` | Wisconsin library: 31 scenarios, sources, notify keys, legend. Checked 2026-11-26. |
| `state-template.json` | Starter and notes for the next states (MN, MI, IA, IL) plus a county and city checklist. |
| `org-procedures-template.csv` / `.json` | Import templates for a company's own procedures. |
| `org-procedures-sample.txt` | Fictional handbook for testing the AI-assisted import. It has deliberate problems the app should flag. |

## Scenario fields

- `id` stable id (`WI-FALL-01`). Other states reuse the part after the state code so company procedures map across states.
- `level` first response: `now` (911), `wake` (manager now), `nurse`, `morning`.
- `triage` optional yes/no questions; `yes`/`no` is a level or another scenario id.
- `roles` steps for `caregiver`, `manager`, `owner`.
- `notify` who to tell and by when: `key` (see `notify_keys`), `clock` (plain words), `hours` or `business_days` (for comparing), `settings` (`afh`, `cbrf`), `layer`, `cite`, `status`, `required`.
- `document`, `wording` (casual vs professional), `legal` (layered federal, state, county, city, payer), `clarity` (one question, one answer, label `rule`/`reading`/`open`).

## Status

`verified` = read in the source on the checked date. `unverified` = from an earlier summary or general knowledge. `open` = sources conflict or are silent; ask DQA or counsel. `house` = a house procedure a company can change.

## Company layer

A company's procedures sit on top of the law (layer `org`). The app compares each company `notify` time with the strictest required baseline entry for the same key and setting, and flags it if slower, if a required notice is missing, or if a step matches a risky pattern (for example asking permission before 911). The AI import only maps text to scenarios; the legal comparison is code.
