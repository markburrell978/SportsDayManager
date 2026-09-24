# Deployment

## Current production deployment

Production v1.0.0 consists of:

- static `web/` files deployed by `.github/workflows/pages.yml` to GitHub Pages;
- the Apps Script `/exec` address selected by `web/js/config.js`;
- the Google Sheet selected privately by Apps Script configuration.

The Pages workflow runs on pushes to `main` and uploads only `web/`. The
Supabase project, migration documents and private settings do not enter the
Pages artifact. The live endpoint has not changed.

Do not run `clasp push`, replace an Apps Script deployment, edit the production
Google Sheet or change `web/js/config.js` during staging work.

## Local Supabase practice

Follow `docs/SUPABASE_LOCAL_SETUP.md` to run the local database, then use
`docs/PRACTICE.md` to open the website. Local reset and seed commands are safe
only for the disposable local database.

## Hosted Supabase staging

The isolated hosted staging project was created and validated on 2026-09-23.
It contains only fictional seed data. All five migrations and the
`sports-day-api` Edge Function are deployed, and an allow-listed organiser can
sign in through the local staging launcher.

See `docs/STAGING_REPORT.md` for the project reference, validation evidence,
credential-remediation record, restart command and remaining work.

The staging launcher reads the ignored `.env.staging.json` file, validates that
it contains an HTTPS Supabase project address and a public publishable key, and
serves `web/` only on `127.0.0.1:8080`:

```bash
python3 supabase/scripts/staging.py
```

Only public browser configuration may be placed in that file. Database
passwords, secret keys, organiser passwords and privileged connection strings
must remain in Supabase-managed secrets or another approved private store.

Before applying any later staging schema change, inspect the plan:

```bash
npx supabase db push --dry-run --linked
```

Never apply the fictional seed to production and never run a linked database
reset against staging or production.

## Edge Function access boundary

The Edge Function verifies each bearer token with Supabase Auth and checks the
verified user ID against `SPORTS_DAY_ORGANISER_IDS`. It permits only origins in
`SPORTS_DAY_ALLOWED_ORIGINS`. Direct browser table access remains blocked by
RLS defaults.

Hosted deployments use Supabase's current publishable-key configuration for
Auth verification. The local stack retains its legacy anonymous-key fallback
because current local Supabase output still supplies that key. Neither value is
a privileged database credential.

## Future production Supabase

Production remains `apps-script` until data migration, reconciliation,
realistic performance, least-privilege security, full rehearsal and rollback
gates pass. The future static Pages configuration may contain a public project
address and publishable key only.

Use `docs/migration/CUTOVER_RUNBOOK.md` only after those gates pass. Use
`docs/migration/ROLLBACK.md` during the defined rollback window. Preserve the
Apps Script deployment and Sheet backup until explicit retirement approval.
