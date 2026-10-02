# Coding standards

This repository uses a small, enforceable standard chosen for the languages and
runtimes already in the project. It is based on the
[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
for JavaScript and TypeScript, and the
[Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
for Python. Prettier makes layout deterministic and ESLint catches correctness,
readability and naming problems.

## JavaScript and TypeScript

- Use two-space indentation, semicolons, single-quoted strings and trailing
  commas where the syntax permits them.
- Use `lowerCamelCase` for variables and functions, `UpperCamelCase` for classes
  or namespace-style application objects, and `UPPER_SNAKE_CASE` for true
  constants.
- Prefer full words: `eventIdentifier`, `databaseConnection`,
  `requestParameters` and `configuration`. The linter rejects one-letter names
  and common shortenings such as `id`, `url`, `config`, `params`, `num` and
  `idx` when they are local bindings.
- Give named functions a brief purpose comment. Self-explanatory inline
  callbacks are exempt because comments on every small callback would obscure
  the workflow.
- Always use braces for control flow, strict equality and `const` unless a
  binding must be reassigned.
- Escape untrusted text before assigning HTML. Put record identifiers in
  escaped `data-*` attributes and read them through `dataset`; do not interpolate
  them into executable inline-handler source.
- Keep functions focused on one operation and extract shared translation,
  validation or persistence logic when it removes real duplication.

## Python

- Use four-space indentation, `snake_case` names and a maximum line length of
  88 characters.
- Use full words for local variables and parameters. The local check rejects
  one-letter bindings, common abbreviations and `_id`/`_ids` suffixes in favor
  of `identifier`/`identifiers`.
- Add a short docstring to every function and class.
- Standard-library module names such as `os`, `sys` and `uuid`, Python special
  method names, and external protocol keys remain unchanged.

## SQL, HTML and CSS

- PostgreSQL tables and columns use `lower_snake_case`. Migrations are ordered,
  immutable once shared, transactional where appropriate and contain comments
  for non-obvious constraints or triggers.
- HTML favors semantic elements, explicit button types and accessible status or
  focus behavior. Dynamic text is escaped before insertion.
- CSS uses two-space indentation, existing design tokens/colors where possible,
  responsive layouts and non-flashing emphasis.

## Compatibility exceptions

The v1 public API and stored Sheet shapes use names such as `ID`, `EventRunID`
and `PointsAwarded`; these remain unchanged at the system boundary. API action
names such as `getCurrentEventRun` also remain stable. PostgreSQL converts these
fields internally through an explicit mapping.

Apps Script remains the maintained source for event business rules during the
migration. `supabase/scripts/sync_legacy_services.py` generates the matching
Edge Function service adapters. Files marked as generated must be changed via
their Apps Script source and regenerated.

Apps Script can run on V8 versions without reliable `Error.cause` support. The
one compatibility wrapper that includes the original message is exempt from
ESLint's `preserve-caught-error` rule; internal database errors are still hidden
at the HTTP boundary.

## Running the checks

Install the pinned tools once:

```bash
npm ci
```

Then run the merge-review checks:

```bash
npm run check
```

This verifies formatting, JavaScript/TypeScript lint rules, Python naming and
docstrings, generated service consistency, and the frontend unit tests. Pull
requests run the same command through `.github/workflows/quality.yml`.

Database and Edge Function integration checks require local Supabase and are
documented in `docs/SUPABASE_LOCAL_SETUP.md` and
`docs/migration/STAGE_4_API.md`.
