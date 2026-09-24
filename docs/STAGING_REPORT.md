# Supabase staging report

Report date: 2026-09-23; updated 2026-09-24

## Plain-English outcome

The Supabase test system is online and working. It contains fictional Sports Day
data only. The public website still uses Google Apps Script and Google Sheets,
so none of this work changed the live Sports Day.

The tested staging project is:

- project reference: `jnzyedbrkxxaqxgsaavc`;
- project address: `https://jnzyedbrkxxaqxgsaavc.supabase.co`;
- region: West Europe (London);
- local staging website: `http://127.0.0.1:8080` while the launcher is running.

## What was set up

1. The repository was linked to the isolated Supabase staging project.
2. All five ordered database migrations were applied.
3. The fictional seed data was loaded. It covers all five event formats.
4. An organiser account was created in Supabase Authentication and its user ID
   was added to the server-side organiser allow-list.
5. The allowed website origins were restricted to the local staging launcher.
6. The `sports-day-api` Edge Function was deployed. Supabase reports it as
   active.
7. A loopback-only staging launcher was added at
   `supabase/scripts/staging.py`. It serves the existing frontend with the
   public staging project address and publishable key. It does not read or
   store the organiser password.
8. The browser displays a clear **Staging · Fictional data** banner.

The ignored `.env.staging.json` file contains only the public project address
and public publishable key. It is excluded from Git. Database credentials,
organiser passwords and privileged keys are not served to the browser.

## Validation performed

The following checks passed against hosted staging:

- Supabase reported that the remote database was up to date, with no pending
  migrations or seed operations.
- Supabase reported the deployed `sports-day-api` function as active.
- An anonymous request using the public publishable key was rejected with HTTP
  401.
- The organiser could sign in through the application.
- Teams, competitors, point profiles, all five events, current event runs and
  event history loaded from the hosted database.
- The initial leaderboard displayed Alpha 40, Beta 35, Gamma 35 and Delta 31.
- Changing one fictional Round Robin winner displayed pending-result notices
  on Events and Leaderboard while the confirmed leaderboard remained
  unchanged.
- Confirming the correction cleared the notice and changed the leaderboard to
  Alpha 36, Beta 36, Gamma 36 and Delta 32.
- Restoring the original winner displayed the notice again. Confirming the
  restoration cleared it and returned the leaderboard exactly to Alpha 40,
  Beta 35, Gamma 35 and Delta 31.
- The final Round Robin screen showed the original winner and no unconfirmed
  changes. The fictional staging data was therefore left in its original
  confirmed state.

### Five-event walkthrough — 2026-09-24

A second hosted walkthrough checked the current-run and read-only history views
for every event format without changing any data:

- Round Robin displayed all six matches, four confirmed current results and
  both its current Run 2 and previous Run 1 histories.
- Tournament displayed both semi-finals, the third-place playoff, final,
  ordered placings and four confirmed history rows.
- Heats and Final displayed all eight saved entrants, Male and Female heats,
  both ordered finals and eight confirmed history rows.
- Distance displayed both Male and Female team orders, including the signed
  Challenge profile values, and eight confirmed history rows.
- Double Team displayed both combined sides, its saved winner and four
  confirmed history rows awarding each side member independently.

After the walkthrough, the leaderboard still displayed Alpha 40, Beta 35,
Gamma 35 and Delta 31. No pending-results notice was present. The staging data
was unchanged.

### Full simulated Sports Day — 2026-09-24

A complete write workflow was then performed against hosted staging using only
fictional data. Each event was reset to create a new current run, completed,
confirmed and checked in Event History.

| Event | Current run | Confirmed rows | Rehearsal outcome |
| --- | ---: | ---: | --- |
| Round Robin | 3 | 4 | Alpha and Gamma tied first on 9 points; Beta and Delta tied third on 4 |
| Tournament | 2 | 4 | Gamma first, Alpha second, Beta third, Delta fourth |
| Heats and Final | 2 | 8 | Alpha won Male; Delta won Female |
| Distance | 2 | 8 | Beta won Male; Gamma won Female |
| Double Team | 2 | 4 | Alpha and Delta beat Beta and Gamma |

The pending-results banner appeared after result entry. The leaderboard kept
its last confirmed totals until each event was complete and its prominent
confirmation button was used. Confirmation cleared the banner and applied the
new points. The Distance event also required and passed its explicit
mark-complete confirmation step.

All five events finished in the `COMPLETE` state with no unconfirmed results.
The final leaderboard exactly matched the points entered during the rehearsal:

| Position | Team | Points |
| ---: | --- | ---: |
| 1 | Alpha | 40 |
| 1 | Gamma | 40 |
| 3 | Delta | 31 |
| 4 | Beta | 30 |

Event History retained every superseded run. Round Robin showed current Run 3
and previous Runs 2 and 1. The other four events showed current Run 2 and
previous Run 1, with the expected confirmed row counts in every current run.
The hosted staging project has been left in this completed fictional state as
an audit trail for review.

Local review checks also passed after the staging changes:

- Prettier formatting;
- ESLint and descriptive-name rules;
- Python naming, line-length and docstring checks;
- generated-service drift checks;
- 15 frontend tests, including the hosted-staging configuration boundary;
- Deno type checking for the Edge Function;
- `git diff --check`;
- a repository scan confirming that the exposed legacy-key fingerprint was
  not written to a file.

## Credential incident and response

While retrieving the public browser key, the Supabase CLI unexpectedly printed
a legacy `service_role` key even though the command did not request revealed
secrets. This appeared in the private command output for this development
session. It was never placed in source code, documentation or the website.

The response was completed immediately:

1. The application and Edge Function were changed to use Supabase's current
   publishable-key configuration.
2. The Edge Function was redeployed with that change.
3. Legacy API keys were disabled in the staging project.
4. The old legacy HS256 signing key was revoked and the current signing key was
   verified as ECC P-256.
5. The repository was scanned for the exposed key fingerprint and no file
   contained it.
6. Sign-in, API access and the complete confirmation/restoration test passed
   after the revocation.

The exposed credential is now unusable. This affected an isolated project with
fictional data and did not expose the live Google Sheet or production Apps
Script system.

## Code committed after the owner's initial transition commit

The following work is included in the draft pull request for review:

- the Edge Function reads the hosted publishable-key configuration and retains
  the local Supabase legacy-anon-key fallback;
- the browser configuration uses the clearer `publishableKey` name;
- the frontend recognizes both Practice and Staging as test environments;
- the staging page is restricted to the local launcher and shows the correct
  banner/sign-in wording;
- the practice launcher emits the same public-key field;
- the new staging launcher validates its ignored public settings and serves
  only `web/` files;
- frontend fixtures were updated and a staging-boundary test was added;
- migration, deployment and handover documentation now records the hosted
  result.

## How to open staging again

From the repository root, run:

```bash
python3 supabase/scripts/staging.py
```

Then open `http://127.0.0.1:8080` and sign in with the organiser account that
was created in Supabase. The launcher must remain running. The ignored
`.env.staging.json` file must remain on this computer.

## What we will do next

1. Verify the retriggered Cloudflare Workers preview check on draft pull
   request #2. Its failures were caused by an omitted static asset directory
   and required Worker metadata existing only on an unmerged Cloudflare setup
   branch. The dashboard version command now includes `--assets ./web/`, and
   `wrangler.jsonc` records the Worker metadata in the repository.
2. Resolve any reviewer findings before the pull request is made ready.
3. Build repeatable Google Sheet export and Supabase import tooling with row
   counts, checksums and foreign-key validation.
4. Copy real data into a restricted rehearsal environment only after private
   backups have been created and restore-tested.
5. Measure realistic latency, memory and transaction-lock behavior, then
   complete the least-privilege production database design.
6. Rehearse cutover and rollback. Change the public website only after every
   acceptance gate passes and the owner explicitly approves production
   cutover.

The live Apps Script and Google Sheets system stays available throughout this
work and remains the rollback path.
