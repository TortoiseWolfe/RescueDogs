/**
 * Playwright Global Setup
 *
 * Runs ONCE before any tests start. Validates prerequisites and fails fast
 * if configuration is invalid, instead of timing out test by test.
 *
 * Checks:
 * 1. Required environment variables are set
 * 2. Supabase is reachable
 * 3. Test users exist in database
 */

import { createClient } from '@supabase/supabase-js';
import { findAuthUserByEmail } from './utils/find-auth-user';
import {
  obtainAuthSession,
  isCaptchaProtectionError,
} from './utils/captcha-auth';

interface PrerequisiteError {
  category: string;
  message: string;
  fix: string;
}

async function globalSetup(): Promise<void> {
  console.log('\n🔍 Running E2E prerequisite checks...\n');

  const errors: PrerequisiteError[] = [];

  // 1. Check required environment variables
  const requiredEnvVars = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      fix: 'Add NEXT_PUBLIC_SUPABASE_URL to GitHub secrets',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      fix: 'Add NEXT_PUBLIC_SUPABASE_ANON_KEY to GitHub secrets',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      fix: 'Add SUPABASE_SERVICE_ROLE_KEY to GitHub secrets (required for test user setup)',
    },
    {
      name: 'TEST_USER_PRIMARY_EMAIL',
      fix: 'Add TEST_USER_PRIMARY_EMAIL to GitHub secrets (e.g., yourname+test@gmail.com)',
    },
    {
      name: 'TEST_USER_PRIMARY_PASSWORD',
      fix: 'Add TEST_USER_PRIMARY_PASSWORD to GitHub secrets',
    },
  ];

  for (const { name, fix } of requiredEnvVars) {
    if (!process.env[name]) {
      errors.push({
        category: 'Environment Variable',
        message: `${name} is not set`,
        fix,
      });
    }
  }

  // If critical env vars are missing, fail immediately
  if (errors.length > 0) {
    printErrors(errors);
    throw new Error(
      `E2E prerequisites not met: ${errors.length} missing environment variables`
    );
  }

  // 2. Check Supabase connectivity (in-container admin client — prefer the
  // compose-internal URL for the local sandbox; falls back to the public URL
  // for cloud/CI where SUPABASE_ADMIN_URL is unset). See #121.
  const supabaseUrl =
    process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let adminClient;
  try {
    adminClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Test connectivity by listing users (requires service role)
    const { error } = await adminClient.auth.admin.listUsers({ perPage: 1 });
    if (error) {
      errors.push({
        category: 'Supabase Connection',
        message: `Failed to connect: ${error.message}`,
        fix: 'Verify SUPABASE_SERVICE_ROLE_KEY is correct and Supabase project is active',
      });
    } else {
      console.log('✓ Supabase connection successful');
    }
  } catch (err) {
    errors.push({
      category: 'Supabase Connection',
      message: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Check NEXT_PUBLIC_SUPABASE_URL is correct and network is available',
    });
  }

  // 3. Check test users exist
  if (adminClient && errors.length === 0) {
    const testUsers = [
      { email: process.env.TEST_USER_PRIMARY_EMAIL!, name: 'PRIMARY' },
      { email: process.env.TEST_USER_TERTIARY_EMAIL, name: 'TERTIARY' },
    ].filter((u): u is { email: string; name: string } => !!u.email); // Only check users that are configured

    for (const { email, name } of testUsers) {
      const exists = (await findAuthUserByEmail(adminClient, email)) !== null;
      if (exists) {
        console.log(`✓ Test user ${name} exists: ${email}`);
      } else {
        errors.push({
          category: 'Test User',
          message: `${name} test user not found: ${email}`,
          fix: `Create user ${email} in Supabase Auth dashboard or via admin API`,
        });
      }
    }
  }

  // 4. Verify PRIMARY can obtain a session. After Turnstile enforcement
  //    (#302 / #231), anon password grant requires captcha_token, so we use
  //    obtainAuthSession (password, then admin magic-link fallback).
  if (errors.length === 0) {
    console.log('\n🔑 Verifying PRIMARY user credentials...');

    const result = await obtainAuthSession(
      process.env.TEST_USER_PRIMARY_EMAIL!,
      process.env.TEST_USER_PRIMARY_PASSWORD!
    );

    if (!result.ok) {
      const message = result.error;

      // Every shard's global setup mints a magic link for the same PRIMARY
      // email, and each new link invalidates the previous one. Losing that
      // race is transient — obtainAuthSession already retries, and each test
      // mints its own link — so it must not take down the whole shard.
      // Genuine misconfiguration (bad password, missing service key) still
      // fails fast here.
      const isMagicLinkRace =
        isCaptchaProtectionError(message) &&
        /invalid or has expired|expired|invalid/i.test(message);

      if (isMagicLinkRace) {
        console.warn(
          `⚠️  PRIMARY session could not be minted during setup (${message}).\n` +
            '   This is usually parallel shards racing the same magic link; tests mint their own.'
        );
      } else {
        errors.push({
          category: 'Test User Password',
          message: `PRIMARY user sign-in failed: ${message}`,
          fix: message.toLowerCase().includes('invalid login')
            ? `TEST_USER_PRIMARY_PASSWORD in GitHub secrets does not match the password for ${process.env.TEST_USER_PRIMARY_EMAIL} in Supabase. Update the secret or reset the user's password.`
            : message.toLowerCase().includes('rate')
              ? 'Rate limited - too many sign-in attempts. Wait 15 minutes or increase rate limits in Supabase.'
              : isCaptchaProtectionError(message)
                ? 'Supabase captcha is enabled; ensure SUPABASE_SERVICE_ROLE_KEY is set so E2E can fall back to admin magic-link sessions.'
                : `Check Supabase logs for details: ${message}`,
        });
      }
    } else {
      console.log(
        `✓ PRIMARY user credentials verified (via ${result.via}${
          result.via === 'admin-link'
            ? '; password grant blocked by captcha'
            : ''
        })`
      );
    }
  }

  // Final check
  if (errors.length > 0) {
    printErrors(errors);
    throw new Error(`E2E prerequisites not met: ${errors.length} issues found`);
  }

  console.log('\n✅ All prerequisites met. Starting tests...\n');
}

function printErrors(errors: PrerequisiteError[]): void {
  console.error('\n❌ E2E PREREQUISITE CHECK FAILED\n');
  console.error(
    'The following issues must be resolved before tests can run:\n'
  );

  const byCategory = errors.reduce(
    (acc, err) => {
      if (!acc[err.category]) acc[err.category] = [];
      acc[err.category].push(err);
      return acc;
    },
    {} as Record<string, PrerequisiteError[]>
  );

  for (const [category, categoryErrors] of Object.entries(byCategory)) {
    console.error(`[${category}]`);
    for (const err of categoryErrors) {
      console.error(`  ❌ ${err.message}`);
      console.error(`     Fix: ${err.fix}`);
    }
    console.error('');
  }

  console.error(
    'Tests will NOT run until these issues are fixed.\n' +
      'This prevents wasting 30+ minutes on tests that will fail anyway.\n'
  );
}

export default globalSetup;
