# Project Rules

When changing a file, regenerate the whole file.

Never invent project structure or remove existing constants without a documented migration reason.

Preserve public APIs and field-tested v1.0.0 behaviour wherever practical.

Use the repository and deliberate later implementation changes as the source of truth.

Prefer extending existing code over rewriting it.

Follow `docs/CODING_STANDARDS.md` and keep `npm run check` passing.

Keep `apps-script/` operational until rollback retirement is explicitly approved.

Keep the frontend in `web/` and deployed through the existing GitHub Pages workflow.

Represent every database schema change as an ordered SQL migration.

Preserve existing stable IDs as text unless a later migration explicitly maps them.

Use foreign keys, constraints and transactions for multi-row event workflows.

Never commit secrets, privileged credentials, private production inventories or real participant exports.

Never expose the Supabase service-role key, database password or privileged connection string to `web/`.

Do not deploy, migrate production data, change production endpoints or create Git commits unless explicitly instructed.
