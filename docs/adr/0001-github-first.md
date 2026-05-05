# ADR 0001 — GitHub-first state, no external database in MVP

Date: 2026-05-05
Status: accepted

## Context

The factory needs to track jobs, decisions, code, logs, and artifacts. Original drafts
considered Supabase (Postgres) for state. The user requested an MVP with GitHub as the
sole source of truth.

## Decision

- **Job** = GitHub Issue in `dmnavalon/autonomus`.
- **State machine** = labels (`state:*`).
- **Per-step records** = comments on the Issue (compact JSON code blocks).
- **Code** = branch + Pull Request on the target app repo.
- **Logs / screenshots / Playwright traces** = GitHub Actions artifacts.
- **Agent instructions** = `agents/<n>/instructions.md` (versioned files).
- **Flow recipes** = `flows/<type>.md` (versioned files).
- **Allowed users** = `registry/users.json` (versioned).
- **Known apps** = `registry/apps.json` (versioned).
- **No Supabase / Postgres / KV in MVP.**

## Consequences

Pros:
- Zero infrastructure cost beyond GitHub + Vercel.
- Full audit trail by design (every change is a commit or a comment).
- Diego can inspect any job entirely from the GitHub UI.

Cons / accepted tradeoffs:
- Cross-job analytics require scripts that scrape Issues / Actions API. Acceptable for MVP
  volume.
- Label-based state limits us to ~50 transitions per job (GitHub label-event quota). Far
  above the cap we'll hit (~15).
- Issue body cannot store binaries → Playwright traces stored as Action artifacts (auto-pruned
  after 90 days unless promoted).

## Revisit

If we exceed 50 jobs/day or need 30-day-trend dashboards, evaluate Postgres on Vercel
Marketplace (Neon). Until then, keep GitHub-first.
