# Stage 1 — Preserve v1.0.0

Status: repository recovery point verified; owner-held backup and private inventory actions remain manual

## Objective and boundary

Preserve the field-tested Google Sheets release as a permanent rollback point before changing application behaviour. This stage does not modify the frontend, Apps Script source, Apps Script deployment or production spreadsheet.

## Verified recovery references

| Item | Verified reference | Verification |
|---|---|---|
| Git source | `v1.0.0` → `6d81224f8f0cc3609f35db4753a2d02c1227947c` | `git rev-parse v1.0.0`; tag and current `main` resolve to the same commit |
| Tag type | Lightweight Git tag | `git cat-file -t refs/tags/v1.0.0` returned `commit` rather than `tag` |
| GitHub Pages source | `web/` at `v1.0.0` | Every deployed HTML, CSS and JavaScript file matched its local `web/` counterpart byte-for-byte; the workflow deploys only `./web` from `main` |
| GitHub Pages URL | `https://markburrell978.github.io/SportsDayManager/` | Existing public Pages deployment responded and matched the checked files |
| Apps Script production deployment | Version 28, description `Web App Version v1.0.0` | Listed with `clasp deployments`; its `/exec` deployment ID matches `web/js/config.js` |
| Apps Script source | Apps Script version 28 | A read-only temporary `clasp clone` matched all 15 repository `.js` files byte-for-byte. The downloaded manifest adds deployment-managed `webapp` metadata only. |
| Apps Script secondary v1 reference | Version 29, description `Web App Exec v1.0.0` | Listed with `clasp deployments`; it is not the URL selected by the production frontend |
| Production spreadsheet | Existing ID in `apps-script/Config.js` | Do not duplicate this identifier in public migration documentation; record it in the private inventory |

The existing `v1.0.0` tag already provides the required checkout point, but it is not annotated. Replacing a published lightweight tag would rewrite the tag reference and is intentionally not done automatically. If the owner requires an annotated tag, first confirm no downstream automation relies on the existing tag, then explicitly approve replacing the tag at the exact same commit:

```bash
git tag -d v1.0.0
git tag -a v1.0.0 6d81224f8f0cc3609f35db4753a2d02c1227947c \
  -m "v1.0.0 field-tested Google Sheets production release"
git push origin :refs/tags/v1.0.0
git push origin v1.0.0
```

This is a manual, history-affecting operation and is not required to check out the verified rollback commit.

## Private production inventory

Copy `PRIVATE_PRODUCTION_INVENTORY.template.md` to `PRIVATE_PRODUCTION_INVENTORY.md` in this directory and complete it outside Git. The real file is ignored. It must record:

- Git commit and tag;
- Apps Script project and deployment references;
- production `/exec` URL;
- production spreadsheet ID and backup location;
- GitHub Pages production URL;
- date of the successful field event;
- backup date, owner and checksums;
- known production limitations.

The successful field-event date is not present in the repository and must be supplied by the owner.

## Manual backup procedure

Perform this before any cutover rehearsal and after material v1.0.0 data changes.

### Google Sheets

1. Open the production spreadsheet and use **File → Make a copy**. Name it with the UTC date and `v1.0.0`.
2. Store the copy in an owner-controlled Drive location with restricted access.
3. Download the workbook as `.xlsx` for whole-workbook recovery.
4. Export every relevant tab as CSV: Teams, Competitors, PointProfiles, Events, EventRuns, Results, Matches, RaceResults, EventCompetitors, DistanceResults, DoubleTeamMatches and Attempts when present.
5. Record each tab name, header row, row count and SHA-256 checksum in the private inventory.
6. Do not place real participant exports in this repository.
7. Test recovery by importing the workbook into a separate non-production spreadsheet and checking tab names, headers and row counts.

### Apps Script

1. Record `clasp deployments` output in the private inventory.
2. Preserve deployment version 28 and do not replace or delete its deployment.
3. Clone the immutable version into a private backup directory:

   ```bash
   clasp clone <SCRIPT_ID_FROM_PRIVATE_INVENTORY> 28
   ```

4. Compare the downloaded `.js` files with `apps-script/` at `v1.0.0`.
5. Retain `.clasp.json` and deployment metadata securely; neither is a replacement for the source snapshot.

### Frontend and Git

1. Verify the tag resolves to the recorded commit:

   ```bash
   git rev-parse v1.0.0
   ```

2. Create an offline source archive outside the repository:

   ```bash
   git archive --format=tar.gz --output=/secure/backup/sports-day-manager-v1.0.0.tar.gz v1.0.0
   ```

3. Record the archive checksum and the Pages URL in the private inventory.
4. Retain the current GitHub Pages workflow and repository access needed to redeploy the tag's `web/` directory.

## Restore test

A complete restore rehearsal should use non-production resources:

1. Check out `v1.0.0` in a temporary worktree.
2. Restore the workbook backup to a separate Google Sheet.
3. clone Apps Script version 28 to a temporary directory and point a test deployment at the restored sheet;
4. serve the tagged `web/` directory locally with its configuration changed only in the temporary copy;
5. verify teams, competitors, every event engine, Confirm Results, reset, leaderboard and Event History;
6. delete or archive only the temporary rehearsal resources after recording results.

## Known v1.0.0 limitations

- The organiser API is anonymously accessible; authenticated organiser access is a later migration stage.
- Offline mode, dynamic event types and a public shareable leaderboard remain deferred.
- Several event engines assume exactly four active teams.
- Apps Script locks protect key workflows, but Google Sheets does not provide PostgreSQL-style multi-table transactions.
- The production spreadsheet identifier is currently present in Apps Script source; it must not be copied into new public documentation or frontend code.

## Acceptance and manual tests

- [x] Local working tree was clean before migration files were added.
- [x] `v1.0.0` can be checked out at the recorded commit.
- [x] Every deployed Pages HTML, CSS and JavaScript artifact matches the tagged source.
- [x] The frontend still selects the v1.0.0 Apps Script `/exec` deployment.
- [x] Deployed Apps Script JavaScript matches repository source.
- [x] The old Apps Script deployment remains listed and available.
- [ ] Owner completed the private production inventory, including field-event date.
- [ ] Owner created and restore-tested the restricted spreadsheet backup.
- [ ] Owner created and checksum-verified the offline frontend/Apps Script backup.

## Rollback consideration

Stage 1 changes documentation only. There is no application rollback to perform. Do not delete or redeploy the verified Apps Script deployment, change `web/js/config.js`, move the production spreadsheet, or retarget the Pages workflow during Stages 1–2.

## Files changed by this stage

- `docs/migration/STAGE_1_PRESERVATION.md`
- `docs/migration/PRIVATE_PRODUCTION_INVENTORY.template.md`
- `.gitignore` (private inventories, exports, backups and local Supabase state)
