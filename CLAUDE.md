# Deployment workflow

The deployed site builds from GitHub `main`. The user has asked that after any
code change is made and verified working, it be **committed and pushed to
`main` automatically, without asking for confirmation first** — otherwise the
change only exists locally/in the dev preview and never reaches the deployed
site (this happened once and confused the user, since they were testing the
deployed site while the fix only existed in the local dev server).

- Standing authorization: no need to ask "should I commit and push?" for
  normal feature/fix work on this repo — just do it once the change is
  verified (dev server compiles, no console errors, and the feature was
  exercised in the browser when it's UI-observable).
- Still use judgment: don't push half-finished or untested changes, and still
  ask first for anything destructive (force-push, history rewrite, etc.) per
  the normal git safety rules.
- If a change requires a manual step outside the repo (e.g. a Supabase SQL
  migration), call that out clearly before/while pushing — pushing code that
  depends on a migration the user hasn't run yet can break the live site's
  save path. (This also happened once — see git log around "add break-time
  cards" — insert into `scheduled_places` failed and briefly wiped the live
  schedule until the migration was applied. Prefer editing DB schema first,
  confirmed applied, before pushing code that writes the new columns.)
