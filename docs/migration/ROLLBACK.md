# Migration Rollback and Legacy Retirement

## Rollback window

Keep the v1.0.0 Apps Script deployment and production spreadsheet available through at least one complete rehearsal and one successful live Supabase event. Archive rather than delete. Retirement requires explicit owner approval.

## Rollback triggers

- organiser authentication blocks operation;
- migrated data is missing/corrupt;
- scoring, tie handling, current-run filtering or History is wrong;
- engine writes, confirmation or reset fail;
- security configuration is unsafe;
- stable operation cannot be restored quickly.

## Procedure

1. Stop Supabase writes and record the cutoff time.
2. Preserve Supabase logs, database backup and post-cutover row counts.
3. Decide whether any Supabase-only writes can be transformed back safely.
4. Record any unavoidable data-loss window; do not claim lossless rollback without reconciliation.
5. Restore the Apps Script provider value in the controlled frontend configuration.
6. Redeploy GitHub Pages through the existing workflow.
7. Verify the recorded v1.0.0 `/exec` deployment and spreadsheet.
8. Run safe read checks, then a controlled organiser workflow.
9. Verify leaderboard and Event History against the restored Sheets authority.
10. Communicate rollback status and preserve Supabase state for diagnosis.

## Retirement criteria

Archive legacy resources only after a full live Supabase event, verified production backups, stable authentication, no critical migration defect, expired rollback need, updated authoritative documentation and explicit owner approval.

