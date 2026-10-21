import { test } from '@playwright/test';

/**
 * Describe block for specs that need the LOCAL Supabase stack (#383).
 *
 * The admin dashboard specs read demo data that only exists after
 * `supabase/seed-admin-demo.sql` is applied, and they need an `is_admin` JWT
 * minted by a database we control. The shared hosted project (what e2e.yml
 * runs against) has neither, and must never get the demo seed.
 *
 * So these specs are defined only where `SUPABASE_ADMIN_URL` points at a local
 * stack: the `Local Supabase` workflow (.github/workflows/local-supabase.yml)
 * and a developer running `pnpm run dev:local`. Everywhere else they are not
 * collected at all, rather than collected and skipped, so a hosted run does
 * not report them as skipped tests. The local workflow fails if it collects
 * none of them, so a misconfigured lane cannot pass by running nothing.
 */
export const describeOnLocalSupabase: (
  title: string,
  callback: () => void
) => void = process.env.SUPABASE_ADMIN_URL ? test.describe : () => {};
