# Cache contract (unstyled-page mitigations) — #237

raisedpaws.com is fronted by Cloudflare over GitHub Pages. Pages serves every
document with `cache-control: max-age=600` and **cannot** be configured
otherwise. Every deploy replaces content-hashed CSS/JS under `/_next/static/`.
A returning visitor who still holds the previous HTML can therefore request
stylesheets that no longer exist: white page, no nav, correct DOM, no error.

Measured on raisedpaws.com before the Cloudflare rule (2026-08-21 / rechecked
2026-09-06):

| resource              | cache-control   |
| --------------------- | --------------- |
| document (`/`)        | `max-age=600`   |
| `/_next/static/css/*` | `max-age=14400` |

Upstream ScriptHammer hit this eight times before fixing it. This fork ships
the same three layers.

## Layer 1 — Cloudflare (the cure) — dashboard, not git

### A. Document `no-cache` — Response Header Transform Rule

**Do not** use a Cloudflare Cache Rule for documents. Browser TTL only ever
_raises_ a value: `override_origin` will not lower an origin `max-age=600`, and
Cloudflare **silently ignores** lower values with no API error. Measured
upstream: `0`, `1`, and `300` were dropped; `700` and `12345` applied.

It must be a **Response Header Transform Rule**:

1. Cloudflare Dashboard → **Rules** → **Transform Rules** → **Modify Response
   Header**
2. Create rule, e.g. name: `Documents: Cache-Control no-cache`
3. Expression (match HTML documents — adjust if needed):

   ```
   (http.request.uri.path eq "/") or ends_with(http.request.uri.path, "/") or ends_with(http.request.uri.path, ".html")
   ```

4. Action: **Set static** → Header name `Cache-Control` → Value `no-cache`
5. Save. **Wait ~45 seconds** for propagation before probing. Immediate curls
   read the _previous_ rule and produce confident, wrong conclusions.

Verify (after ≥60s):

```bash
curl -sSI https://raisedpaws.com/ | tr -d '\r' | grep -iE 'cache-control|cf-ray'
# expect: cache-control: no-cache   and a cf-ray line
```

API token (if automating later) needs **Zone / Transform Rules / Edit**.

### B. Hashed assets — one-year Browser TTL (Cache Rule is OK here)

Raising TTL is fine; only lowering is broken. Create a **Cache Rule** matching
`/_next/static/*` with Browser TTL **1 year** (or `max-age=31536000`).

Verify:

```bash
CSS=$(curl -sL https://raisedpaws.com/ | grep -oE '/_next/static/[^" ]+\.css' | head -1)
curl -sSI "https://raisedpaws.com$CSS" | tr -d '\r' | grep -i cache-control
# expect: max-age >= 31536000
```

## Layer 2 — Asset retention (deploy mitigation)

`scripts/retain-previous-assets.mjs` runs in `.github/workflows/deploy.yml`
after the build merge. It crawls the **live** site (`NEXT_PUBLIC_SITE_URL` or
`NEXT_PUBLIC_DEPLOY_URL`), copies any hashed assets the new build lacks into
`merged-output`, and writes `asset-ledger/` for the next deploy.

- `RETAIN_DAYS: '14'` — duration, not deploy count
- `continue-on-error: true` — network failure must not block shipping, but stays
  visible in Actions

## Layer 3 — StylesheetGuard (client self-heal)

`src/components/subatomic/StylesheetGuard` is mounted in `src/app/layout.tsx`.
On `load`, if every same-origin stylesheet has zero `cssRules`, it clears caches
and navigates to a cache-busting URL (at most once per hour per tab).

## Live CI probe

`.github/workflows/smoke.yml` runs after a successful Deploy (and daily):

| step             | script                                 | what it proves                                    |
| ---------------- | -------------------------------------- | ------------------------------------------------- |
| retained assets  | `scripts/ci/check-retained-assets.mjs` | ledger entries still HTTP 200                     |
| retention window | same, `RETAINED_CHECK=window`          | ledger spans ~`RETAIN_DAYS`                       |
| cache contract   | `scripts/ci/check-cache-headers.mjs`   | documents revalidate, assets long-lived, `cf-ray` |

`REQUIRE_EDGE: 'true'` is required so a missing Cloudflare proxy fails the job.

Until Layer 1 is applied in the Cloudflare dashboard, the cache-contract step
**must fail** against raisedpaws.com — that is the demonstration that the probe
works. Apply the Transform Rule + Cache Rule, wait ≥60s, re-run the workflow.

## Owner

schlajo owns the raisedpaws.com Cloudflare zone. Repo changes alone do not
close #237; the Transform Rule is the acceptance gate for document
`cache-control: no-cache`.
