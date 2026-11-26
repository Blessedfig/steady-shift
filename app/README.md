# Steady Shift test app

Private, signed-in test version of the subscriber app at https://blessedfig.github.io/steady-shift/app/
with every plan unlocked and a "View as" switcher (caregiver, house manager, RN, owner, multi-site operator, family caregiver).

- Sign-in reuses the Owner Desk's Supabase project (`../desk/config.js`). Only desk members get in. A session from the desk works here too, since both pages share the same site.
- All residents, homes and records are fictional sample data in `data.js`. Changes people make while testing are saved only in their own browser (localStorage). "Reset sample data" on the home screen clears them.
- "Ideas and fixes" opens a guided chat (scripted, not AI) that asks what, where, why and how soon, then saves a row of kind `request` (with `source: "test-app"`) to `desk_items`, so it shows on the desk under Requests for Claude. The chat's second tab shows the person's own notes with any reply typed on the desk.
- The casual-to-professional rewrite is a template (word swaps, name removal, flags), not an AI service.
- Rule content comes from the Wisconsin rulebook and Rule Conflicts docs (checked 2026-11-26). Not legal advice.
