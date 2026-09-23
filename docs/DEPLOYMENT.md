# Deployment

## Current production deployment

Production v1.0.0 consists of:

- static `web/` files deployed by `.github/workflows/pages.yml` to GitHub Pages;
- the Apps Script `/exec` URL selected by `web/js/config.js`;
- the Google Sheet selected privately by Apps Script configuration.

Stages 1–2 do not change any of those three references. Do not run `clasp push`, create/replace an Apps Script deployment or edit `web/js/config.js` during schema-only work.

The Pages workflow runs on pushes to `main` and uploads only `./web`. Migration documentation and `supabase/` files do not enter the Pages artifact.

## Local Supabase

Follow `docs/SUPABASE_LOCAL_SETUP.md`. Local migrations and seed data are safe to recreate only in the local disposable database.

## Staging and production Supabase

Remote environment creation/linking is Stage 3 and requires owner-supplied project references. Store database credentials and service-role keys only in Supabase project secrets or approved CI secrets. Public frontend configuration may later contain only public project/API values.

Before any remote push:

```bash
npx supabase db push --dry-run
```

Do not apply the fictional seed to production. Do not run a linked reset against production.

## Future frontend provider configuration

Stage 4/8 will centralise provider selection in the frontend API abstraction. Production remains `apps-script` until every compatibility, security, migration, rehearsal and cutover gate passes. The static Pages deployment must never contain the service-role key, a database password or a privileged connection string.

## Cutover and rollback

Use `docs/migration/CUTOVER_RUNBOOK.md` only after Stages 3–8. Use `docs/migration/ROLLBACK.md` during the defined rollback window. Preserve the Apps Script deployment and Sheet backup until explicit retirement approval.


## Local Edge Function

The replacement API is implemented locally. Follow `docs/migration/STAGE_4_API.md` to serve/test it. It requires a verified Supabase Auth user and a configured organiser UUID allow-list; there is no anonymous development bypass. No function has been deployed remotely. Before deployment, configure server-only credentials, organiser IDs and allowed origins and complete the remaining security/staging gates.

## Practice frontend

Use `docs/PRACTICE.md` for the local website. Its launcher overrides `/js/runtime-config.js` with public-only local settings. The file shipped by GitHub Pages defaults to Apps Script, and `web/js/config.js` retains the existing production URL. Private practice credentials and function settings are stored outside `web/` in ignored `.env.practice*` files. No deployment was performed for this milestone.
