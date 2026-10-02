# Production-readiness and rollback rehearsal

Date: 2026-10-02

## Outcome

The hosted staging API now uses a dedicated PostgreSQL login named
`sports_day_api`. Its password is stored only as an encrypted Supabase Edge
Function secret. The role can select, insert, update and delete rows in the 12
application tables and use their identity sequences. It cannot create tables,
create roles, bypass RLS or read Supabase Authentication data.

The Edge Function prefers `SPORTS_DAY_DATABASE_URL` and retains the managed
`SUPABASE_DB_URL` only as an operational fallback. No database password or
privileged connection address is present in Git or the browser application.

## Test-driven implementation

The database boundary test was written and failed because the role did not
exist before the migration was added. After migration, it passed locally and
against hosted staging. A disposable database then applied every migration,
loaded the complete fictional bundle, ran the role boundary test and was
dropped.

Four configuration tests cover dedicated-address precedence, local fallback,
missing configuration and publishable-key handling. The frontend test suite
also covers the prepared production Supabase configuration, the retained Apps
Script rollback configuration and private staging wording.

## Hosted checks

The dedicated hosted login passed these checks:

- authenticated application-table reads;
- a temporary insert, update and delete inside a rolled-back transaction;
- denial of reads from `auth.users`;
- denial of `create table`; and
- denial of `create role`.

After deployment, the existing allow-listed organiser signed in and loaded the
four-row restricted-data leaderboard through the dedicated role.

## Timed database-connection rollback

The dedicated connection secret was removed so the deployed function used its
managed fallback. Secret removal completed in about 35 seconds, and the
authenticated leaderboard loaded after the following refresh. The dedicated
secret was restored in about 5 seconds; after the function restarted, the same
leaderboard loaded again in about 17 seconds. No application row changed.

The setup credential used in the dashboard was immediately rotated through the
restricted role itself. The rotated credential passed the complete hosted
boundary test. Temporary password, connection, SQL and clipboard data were
removed.

## Frontend rollback finding

A loopback rehearsal served the unchanged Apps Script production configuration
and the real GitHub Pages site was checked independently. Both reached the same
failure: the `getLeaderboard` action waited roughly 28–40 seconds and ended on
Google's page-not-found response. The simpler `getTeams` action still returns
valid application JSON. The public website configuration was never changed by
the rehearsal.

This means Apps Script source and Sheets remain preserved, but the current
deployment cannot be treated as a verified working rollback until its
leaderboard action or deployment is repaired. The final cutover/rollback gate
was explicitly accepted by the owner on 2026-10-02 because private backups are
available and there is time before the next event.

## Prepared production configuration

The branch now contains a reviewable public runtime configuration for the
existing Supabase project. It contains only the HTTPS project URL and public
publishable key and will not affect GitHub Pages unless the branch is merged.
The Apps Script URL remains in `web/js/config.js` for a one-file provider
rollback.

With explicit owner approval, the exact origin
`https://markburrell978.github.io` was added to
`SPORTS_DAY_ALLOWED_ORIGINS`. Its preflight returned HTTP 204 and the matching
`Access-Control-Allow-Origin` header. A preflight from `https://example.com`
returned HTTP 403. Supabase authentication and the organiser UUID allow-list
continue to protect every application request.

## Remaining gates

- Complete pull-request review and merge the production runtime configuration.
- Verify the deployed Pages sign-in, reads and one controlled reversible write.
- Retain Google Sheets and Apps Script through at least one successful live
  Supabase event.
