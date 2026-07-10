# Go-live decisions log

Chronological record of choices made during the Raised Paws launch arc
([#25](https://github.com/TortoiseWolfe/RescueDogs/issues/25)). Updated as we
decide — not only when code merges.

---

## 2026-07-09 — Domain strategy (#26) — revised

**Decision:** Canonical domain is **`raisedpaws.com`**.

**Active domains (2):**

| Domain           | Role                                        |
| ---------------- | ------------------------------------------- |
| `raisedpaws.com` | Canonical — hosts the app                   |
| `raisedpaws.org` | **301 redirect** → `https://raisedpaws.com` |

**Abandoned (2):** `heldpaws.com`, `heldpaws.org` — not renewed / not wired up.
No redirects needed; simplifies go-live.

**Rationale:**

- Brand rebrand to **Raised Paws** landed in [#32](https://github.com/TortoiseWolfe/RescueDogs/issues/32) / PR #33.
- One canonical URL avoids split SEO and split Supabase auth redirect config.
- Original plan (four domains, three 301s) was defensive; we only need `.com` + `.org` pair.

**Registrar:** Domains purchased through **Namecheap**. DNS not configured yet.

- `raisedpaws.com` → GitHub Pages apex records (#27)
- `raisedpaws.org` → Namecheap URL forwarding (or Advanced DNS) to `https://raisedpaws.com`

**Reference:** [#26](https://github.com/TortoiseWolfe/RescueDogs/issues/26)

---

## 2026-07-09 — Hosting platform (#30) — final

**Decision:** **GitHub Pages** (existing deploy pipeline). **Not Vercel** for launch.

| Stakeholder                | Preference                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Jonathan (tech lead)**   | GitHub Pages — already deployed, no Vercel account                                |
| **schlajo (collaborator)** | Personal preference for Vercel, but **agrees to Pages** when simpler for the team |

**Rationale (why Pages wins now):**

- App is `output: 'export'` — static files; Pages already serves `tortoisewolfe.github.io/RescueDogs`.
- **Only one redirect** (`raisedpaws.org` → `.com`) — Namecheap can handle it; multi-domain hosting was the main Vercel advantage and no longer applies.
- Jon owns CI/deploy today; zero new platform onboarding.
- Collaborator attempted Vercel import — blocked on TortoiseWolfe org GitHub app access; not worth solving for launch.

**Superseded (earlier same-day draft):** Vercel on schlajo's personal account — drafted when four-domain 301s were in scope. Revisit only if requirements change.

**Reference:** [#30](https://github.com/TortoiseWolfe/RescueDogs/issues/30)

---

## 2026-07-09 — Hosting options considered (for learning channel)

Brief comparison recorded so the decision is auditable, not just “we picked Pages.”

### GitHub Pages + Namecheap (chosen)

```
Visitor → raisedpaws.com → GitHub Pages
Visitor → raisedpaws.org → Namecheap 301 → raisedpaws.com
```

- **Pros:** Free; deploy already works; Jon's workflow unchanged; one redirect is trivial at registrar.
- **Cons:** `.org` redirect HTTPS quality varies by Namecheap forwarding (test after setup).

### Vercel (deferred)

- **Pros:** schlajo's comfort; one dashboard for host + domains; easy future migration target.
- **Cons:** Jon has no account; TortoiseWolfe org GitHub app approval required; unnecessary for one redirect.

### Cloudflare in front of Pages (not chosen)

- **Pros:** Clean HTTPS 301s; Jon's #30 “middle path” for multi-domain.
- **Cons:** Extra service + nameserver move; overkill for a single `.org` → `.com` redirect.

### Outages (last ~12 months — not the deciding factor)

All three had rare visitor-facing incidents. Neither platform is unreliable enough to drive this choice. **Domain/redirect workflow and who operates deploy** mattered more.

| Platform     | Notable serving events                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Pages | Apr 2026 ~10% error rate ~1.5 hr ([report](https://github.blog/news-insights/company-news/github-availability-report-april-2026/)) |
| Vercel       | Oct 2025 AWS cascade ([postmortem](https://vercel.com/blog/update-regarding-vercel-service-disruption-on-october-20-2025))         |
| Cloudflare   | Nov 2025 global outage (if proxied)                                                                                                |

---

## 2026-07-09 — Will we outgrow GitHub Pages?

**Assessment:** **Unlikely** on the current RescueDogs architecture through the full product roadmap (messaging, payments, shelter pipeline, admin, blog).

The app today:

- `output: 'export'` — static HTML/JS/CSS
- Auth, DB, payments → **Supabase** (client + Edge Functions)
- No production Next.js API routes, middleware, SSR, or ISR

**Triggers that would justify migrating to Vercel later:**

- Next.js API routes or middleware in the app
- SSR, streaming, ISR, or `next/image` optimization
- Per-PR preview deploys as a hard requirement

**Migration difficulty:** **Low** — same `pnpm run build` → `out/` artifact. Move is mostly DNS + GitHub/Vercel env vars + Supabase redirect URLs (#28), not an app rewrite. Keep Pages deploy until Vercel is verified; flip DNS back if needed.

---

## 2026-07-09 — Phased cutover: GitHub Pages + Namecheap

**Do not change Namecheap DNS or GitHub Pages custom domain until:**

1. PR with `public/CNAME` is **merged to `main`**, and
2. **Deploy to GitHub Pages** workflow is green on `main`.

Otherwise `raisedpaws.com` can serve a build that still expects `/RescueDogs` paths
(broken assets). DNS steps are manual and documented in [027-dns-cname.md](./027-dns-cname.md).

### Phase 1 — Repo + GitHub Pages custom domain — [#27]

1. Add `public/CNAME` containing `raisedpaws.com` (auto-drops `/RescueDogs` basePath via `scripts/detect-project.js`).
2. At Namecheap for **`raisedpaws.com`**: GitHub Pages apex A/AAAA records + `www` CNAME per [#27](https://github.com/TortoiseWolfe/RescueDogs/issues/27).
3. GitHub → Settings → Pages: set custom domain `raisedpaws.com`, enforce HTTPS.
4. Verify: `https://raisedpaws.com/` loads; asset URLs have **no** `/RescueDogs` prefix.

### Phase 2 — `.org` redirect (Namecheap only)

1. At Namecheap for **`raisedpaws.org`**: permanent URL forward (301) to `https://raisedpaws.com`.
2. Verify: `curl -sI https://raisedpaws.org/` → `301` → `https://raisedpaws.com/…`
3. If HTTPS on `.org` is ugly, consider Cloudflare for **only** `raisedpaws.org` later (optional).

### Phase 3 — Auth cutover — [#28]

Update Supabase Site URL, redirect allow-list (trailing slashes), edge-function
`NEXT_PUBLIC_SITE_URL`, and GitHub Actions vars. Test sign-up, OAuth, password
reset, Stripe test returns. Remove old `github.io` entries after verification.

### Phase 4 — PWA + docs — [#29]

Confirm manifest `scope` / `start_url` at apex; invert CLAUDE.md CNAME fork-note.

### Diagram

```
Phase 1 (#27)     raisedpaws.com DNS → GitHub Pages
                  repo: public/CNAME → basePath ''

Phase 2           raisedpaws.org → Namecheap 301 → raisedpaws.com

Phase 3 (#28)     Supabase + GitHub vars → auth on raisedpaws.com

Phase 4 (#29)     PWA manifest + CLAUDE.md

heldpaws.*        abandoned (no DNS work)
```

---

## Open / TBD

| Item                                                                  | Status                                   |
| --------------------------------------------------------------------- | ---------------------------------------- |
| Comment #26 on GitHub with revised domain plan (2 active, 1 redirect) | Pending                                  |
| Comment #30 on GitHub with “chose GitHub Pages”                       | Pending                                  |
| Who clicks DNS in Namecheap (schlajo vs Jon)                          | schlajo                                  |
| `raisedpaws.org` redirect propagation                                 | Configured 2026-07-10; verify in browser |
| Future Vercel migration                                               | Documented above; no schedule            |

---

## Ticket order (agreed)

1. [#27](https://github.com/TortoiseWolfe/RescueDogs/issues/27) — DNS + `public/CNAME` + basePath drop (`raisedpaws.com` → GitHub Pages)
2. Namecheap — `raisedpaws.org` → 301 to `.com` (part of go-live; may fold into #27 PR/docs)
3. [#28](https://github.com/TortoiseWolfe/RescueDogs/issues/28) — Supabase auth + edge env
4. [#29](https://github.com/TortoiseWolfe/RescueDogs/issues/29) — PWA manifest + CLAUDE.md

[#30](https://github.com/TortoiseWolfe/RescueDogs/issues/30) — closed by decision (GitHub Pages); no Vercel setup required for launch.
