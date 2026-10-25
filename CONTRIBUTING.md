# Contributing

## Branches (Gitflow)

| Branch | From | Merges into | Purpose |
|---|---|---|---|
| `main` | — | — | Production. Every commit is a release, tagged `vX.Y.Z`. Deploys to Vercel production |
| `develop` | `main` | — | Integration. Deploys to the stable preview |
| `feature/<name>` | `develop` | `develop` | New behaviour (see roadmap in `docs/design-plan.md`) |
| `chore/<name>`, `fix/<name>` | `develop` | `develop` | Tooling, deps, non-urgent fixes, cosmetics |
| `release/<x.y.z>` | `develop` | `main` **and** `develop` | Freeze, version bump, final checks |
| `hotfix/<x.y.z>` | `main` | `main` **and** `develop` | Urgent production fix |

- Never commit directly to `main` or `develop` — open a PR.
- Feature PRs: squash merge. Release/hotfix PRs: merge commit, then tag on `main`.
- Delete branches after merge.

```bash
git switch develop && git pull
git switch -c feature/slot-engine
# ...work...
git push -u origin feature/slot-engine
gh pr create --base develop
```

## Testing rules

**Major features → TDD.** Anything touching booking rules, slots, status changes, auth/roles, the database constraints, or WhatsApp messaging:

1. Write a failing test that states the behaviour.
2. Write the least code to pass it.
3. Refactor with tests green.

The PR should show the test landing with (or before) the code.

**Minor / cosmetic / non-breaking changes** (copy, styles, layout, static pages): build passes, lint passes, checked by hand at phone width (390px) and desktop. No new tests required.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `style:`.

## Before opening a PR

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Branch protection

Ruleset `protect-main-and-develop` (GitHub → Settings → Rules):

- `main` and `develop` change only through a PR; no force-push, no deletion.
- Every PR needs 1 approval from the code owner (`.github/CODEOWNERS` → @himanshurai899), stale approvals are dismissed on new pushes, and review threads must be resolved.
- Repo admins can bypass **only through a PR**, so the owner can merge their own PRs; nobody can push straight to these branches.
- Workflows from outside contributors need the owner's approval before they run.
- TODO once CI is on `develop`: add the `check` job as a required status check.
