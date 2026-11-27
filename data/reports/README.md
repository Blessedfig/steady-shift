# Wisconsin required reports (wi-reports.json)

One file the test app uses to work out every report an event needs, who gets it, and by when.
Built by `build.py` (CBRF rules in `cbrf.json`): `python3 data/reports/build.py data/reports/wi-reports.json`.

- **regions**: the four DQA Bureau of Assisted Living regional offices with all 72 counties, address, phone, fax and email
  (DQA regional map, revised Oct 6, 2026). DQA asks for completed forms to be faxed or emailed to the office for the home's county (P-02007).
- **recipients**: regional office, licensing agency, DQA Death Reporting Coordinator (F-62470), Office of Plan Review (fire, F-62500),
  Misconduct Reporting System, police, 911, county adult protective services, ombudsman or Disability Rights Wisconsin,
  local health officer, MCO, guardian, physician, medical examiner, the record.
- **events**: what happened (deaths, fire, catastrophe, missing resident, ER or hospital, police, abuse or neglect, adult at risk,
  emergency restraint, reportable disease, change in condition, medication error, criminal charges). Each lists its reports with
  clock (`immediate`, `hours`, `days`, `business_days`, `next_business_day`, `before_days`, `none`), cite, form, settings (afh, cbrf), status.
- **changes**: planned changes sent ahead (household, services, program statement, client group, capacity, administrator, owner, closing, discharge).
- **records** and **periodic**: what to keep (and for how long) and regular duties, for AFH (DHS 88) and CBRF (DHS 83).
- **open_questions**: the AFH accidental-death clock (DHS 88.03(5)(e)1 says 24 hours, (e)2 says 3 days; the app uses 24),
  and where county-licensed AFHs send reports.

Status: `verified` was read in the source text; `unverified` came from a preview or summary page and needs a check;
`open` means the rules disagree; `house` is a contract or house rule. Sources: DQA P-02007 (09/2026), DHS 88 (Register May 2011),
DHS 83 (Register January 2025; sections from 83.33 on came from preview pages). Not legal advice.
