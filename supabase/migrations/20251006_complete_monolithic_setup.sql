-- ============================================================================
-- COMPLETE MONOLITHIC SETUP
-- Everything in one file: Payment + Auth + Security
-- ============================================================================
-- Purpose: Single migration to create entire database from scratch
-- Created: 2025-10-06
--
-- This migration includes:
-- - Payment System (PRP-015)
-- - User Authentication (PRP-016)
-- - Security Hardening (Feature 017)
--   - Rate limiting (brute force protection)
--   - OAuth CSRF protection
--   - Row Level Security (RLS)
--   - Audit logging
--   - Webhook retry
-- ============================================================================

-- Clean up any existing test user BEFORE transaction
-- (auth.users changes can't be rolled back, so do this first)
DELETE FROM auth.users WHERE email = 'test@example.com';

-- Wrap everything in a transaction - all or nothing
BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- PART 1: PAYMENT SYSTEM TABLES
-- ============================================================================

-- Payment intents (24hr expiry)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud')),
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('month', 'year') OR interval IS NULL),
  description TEXT,
  customer_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(template_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_expires_at ON payment_intents(expires_at);

-- Idempotency key for offline-queue retries (#52). Partial unique index:
-- only enforced when set, so direct-server INSERTs (admin tooling, edge
-- functions) without a key remain valid. Only client-queued INSERTs
-- participate in dedupe.
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key
  ON payment_intents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Retry tracking (#43, B1). Each retry creates a new INSERT-only row that
-- references its parent and bumps retry_count. The "Payment intents are
-- immutable" UPDATE policy below ensures retry_count only ever moves
-- forward (set on INSERT, never UPDATEd).
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS parent_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_parent
  ON payment_intents(parent_intent_id)
  WHERE parent_intent_id IS NOT NULL;

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';

-- Payment results
CREATE TABLE IF NOT EXISTS payment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  charged_amount INTEGER,
  charged_currency TEXT,
  provider_fee INTEGER,
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IN ('webhook', 'redirect') OR verification_method IS NULL),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_status ON payment_results(status);
CREATE INDEX IF NOT EXISTS idx_payment_results_created_at ON payment_results(created_at DESC);

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification';

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL CHECK (plan_amount >= 100),
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'grace_period', 'canceled', 'expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  next_billing_date TEXT,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  retry_schedule JSONB DEFAULT '{"day_1": false, "day_3": false, "day_7": false}'::jsonb,
  grace_period_expires TEXT,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);
-- Duplicate-subscription guard (#5): a user may hold at most ONE live
-- subscription at a time. Server-side root-cause enforcement — the webhook
-- upsert that would create a second live row hits this and is rejected (23505),
-- which the handlers catch and acknowledge gracefully. No trigger / SECURITY
-- DEFINER needed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_live_per_user
  ON subscriptions(template_user_id)
  WHERE status IN ('active', 'grace_period', 'past_due');

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions';

-- Payment provider config
CREATE TABLE IF NOT EXISTS payment_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (config_status IN ('not_configured', 'configured', 'invalid')),
  priority INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{"one_time": false, "recurring": false, "requires_consent": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover';

-- Edge-function idempotency keys (#106). Lets outbound payment functions
-- dedupe retried operations (offline-queue replay, double-click, network
-- retry) by returning the previously-stored result instead of re-calling the
-- provider. Written/read only by service-role (the Edge Functions); not
-- client-facing. See supabase/functions/_shared/idempotency.ts.
CREATE TABLE IF NOT EXISTS edge_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  function_name TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key, function_name)
);

CREATE INDEX IF NOT EXISTS idx_edge_idempotency_lookup
  ON edge_idempotency_keys(idempotency_key, function_name);

COMMENT ON TABLE edge_idempotency_keys IS 'Idempotency cache for outbound payment Edge Functions (#106)';

-- Webhook events (with retry fields from Feature 017)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  signature TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  related_payment_id UUID REFERENCES payment_results(id),
  related_subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  -- Feature 017: Webhook retry fields
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  permanently_failed BOOLEAN NOT NULL DEFAULT FALSE,
  last_retry_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(next_retry_at, permanently_failed) WHERE processed = FALSE AND permanently_failed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed ON webhook_events(permanently_failed, created_at DESC) WHERE permanently_failed = TRUE;

COMMENT ON TABLE webhook_events IS 'Webhook notifications with idempotency and retry';

-- ============================================================================
-- PART 2: AUTHENTICATION TABLES
-- ============================================================================

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_pending ON user_profiles(id) WHERE welcome_message_sent = FALSE;

-- #316: transactional rescue onboarding email (Resend) — distinct from in-app welcome_message_sent
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_email_pending
  ON user_profiles(id) WHERE welcome_email_sent = FALSE;

COMMENT ON COLUMN user_profiles.welcome_email_sent IS
  'True after the post-verify rescue onboarding email was sent (#316). Separate from welcome_message_sent (in-app DM).';

COMMENT ON TABLE user_profiles IS 'User profile information 1:1 with auth.users';

-- Auth audit logs (90-day retention)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink',
    'payment_retry'
  )),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT CHECK (length(user_agent) <= 500),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all auth events (90-day retention)';

-- Idempotent extension of auth_audit_logs.event_type CHECK to include
-- 'payment_retry' (#43, B1). The CREATE TABLE above picks up the new
-- value on a fresh DB; this DROP + ADD applies it to existing DBs.
ALTER TABLE auth_audit_logs DROP CONSTRAINT IF EXISTS auth_audit_logs_event_type_check;
ALTER TABLE auth_audit_logs ADD CONSTRAINT auth_audit_logs_event_type_check
  CHECK (event_type IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink',
    'payment_retry'
  ));

-- ============================================================================
-- PART 3: SECURITY TABLES (Feature 017)
-- ============================================================================

-- Rate limiting (brute force protection)
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- Email or IP
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset', 'contact_form')),
  ip_address INET,
  user_agent TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_attempts(identifier, attempt_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_attempts(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_locked ON rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_unique ON rate_limit_attempts(identifier, attempt_type);

COMMENT ON TABLE rate_limit_attempts IS 'Server-side rate limiting - prevents brute force';

-- Allow contact-form submissions to share the rate_limit_attempts limiter (#309).
-- Fresh DBs pick this up from CREATE TABLE above; existing DBs need DROP + ADD.
ALTER TABLE rate_limit_attempts DROP CONSTRAINT IF EXISTS rate_limit_attempts_attempt_type_check;
ALTER TABLE rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_attempt_type_check
  CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset', 'contact_form'));

-- Enable RLS on rate_limit_attempts (system-managed, service role only)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access" ON rate_limit_attempts;
CREATE POLICY "Service role only access" ON rate_limit_attempts
  FOR ALL
  USING (false);

COMMENT ON POLICY "Service role only access" ON rate_limit_attempts IS
  'Rate limiting data is system-managed. Only service role can access.';

-- OAuth state tracking (CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
  session_id TEXT,
  return_url TEXT,
  ip_address INET,
  user_agent TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_oauth_states_session ON oauth_states(session_id);

COMMENT ON TABLE oauth_states IS 'OAuth state tokens - prevents session hijacking';

-- Enable RLS on oauth_states (CSRF protection tokens)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert state tokens (for OAuth flow initiation)
DROP POLICY IF EXISTS "Anyone can create state tokens" ON oauth_states;
CREATE POLICY "Anyone can create state tokens" ON oauth_states
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read state tokens (for validation during OAuth callback)
DROP POLICY IF EXISTS "Anyone can read state tokens" ON oauth_states;
CREATE POLICY "Anyone can read state tokens" ON oauth_states
  FOR SELECT
  USING (true);

-- Allow anyone to update state tokens (for marking as used)
DROP POLICY IF EXISTS "Anyone can update state tokens" ON oauth_states;
CREATE POLICY "Anyone can update state tokens" ON oauth_states
  FOR UPDATE
  USING (true);

-- Allow anyone to delete expired state tokens (for cleanup)
DROP POLICY IF EXISTS "Anyone can delete expired states" ON oauth_states;
CREATE POLICY "Anyone can delete expired states" ON oauth_states
  FOR DELETE
  USING (expires_at < NOW());

COMMENT ON TABLE oauth_states IS
  'OAuth state tokens are random UUIDs with 5-minute expiration. Safe to allow public access.';

-- ============================================================================
-- PART 4: FUNCTIONS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Auto-create user profile on signup
-- #105: seed display_name so messaging search can find new users. OAuth provider
-- metadata only — NEVER the email local-part. user_profiles is readable by every
-- authenticated user (RLS "Authenticated users can search profiles" ... USING (true)),
-- so an email-derived name publishes part of the user's address to the whole
-- directory. Fall back to an opaque handle the user can replace in Account Settings.
-- Format must stay in sync with extractOAuthDisplayName() in src/lib/auth/oauth-utils.ts.
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_display TEXT;
BEGIN
  v_display := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_username'), ''),
    'User-' || left(replace(NEW.id::text, '-', ''), 8)
  );
  IF v_display IS NOT NULL AND char_length(v_display) > 100 THEN
    v_display := left(v_display, 100);
  END IF;

  INSERT INTO public.user_profiles (id, display_name, created_at, updated_at)
  VALUES (NEW.id, v_display, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- #49: write the 'sign_up' audit event here, in the AFTER INSERT ON auth.users
  -- trigger, so EVERY signup path is captured — email/password form, OAuth
  -- redirect, AND admin-API auth.admin.createUser(). The application-level
  -- logAuthEvent() in SignUpForm only fired on the form path, so OAuth/admin
  -- signups were silently missing and admin_auth_stats().signups_this_month
  -- under-reported. The trigger is now the single source of truth for SUCCESSFUL
  -- signups; the form keeps logging only the FAILED-attempt row (no auth.users
  -- INSERT happens on failure, so the trigger can't cover that case).
  -- provider is best-effort from raw_app_meta_data (defaults to 'email').
  INSERT INTO public.auth_audit_logs (user_id, event_type, success, event_data)
  VALUES (
    NEW.id,
    'sign_up',
    TRUE,
    jsonb_build_object(
      'email', NEW.email,
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user profile / audit log for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Cleanup old audit logs (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- log_auth_audit_event: client-callable write path for auth_audit_logs (#304)
--
-- Browser inserts into auth_audit_logs are RLS-denied (service_role INSERT only),
-- so every logAuthEvent() call previously threw away the row (42501). This
-- SECURITY DEFINER RPC is the insert path: PostgREST populates request.headers,
-- we derive IP/UA server-side, and we insert as the function owner.
--
-- IP policy: prefer cf-connecting-ip / x-real-ip; else the LEFTMOST hop of
-- x-forwarded-for (original client). Spoofable if a client invents XFF before
-- a trusting proxy — still the best signal available without an Edge hop.
-- Invalid IPs → NULL rather than failing the audit write.
--
-- Event normalize: sign_in + success=false → sign_in_failed (burst detector);
-- sign_in + success=true → sign_in_success (admin_audit_trends totals).
--
-- Does NOT cover signup rows from the auth.users AFTER INSERT trigger — those
-- still lack HTTP headers (Auth Hook follow-up).
CREATE OR REPLACE FUNCTION log_auth_audit_event(
  p_event_type    TEXT,
  p_user_id       UUID    DEFAULT NULL,
  p_event_data    JSONB   DEFAULT NULL,
  p_success       BOOLEAN DEFAULT TRUE,
  p_error_message TEXT    DEFAULT NULL,
  p_user_agent    TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers     JSONB;
  v_ip_raw      TEXT;
  v_ip          INET;
  v_ua          TEXT;
  v_event       TEXT;
  v_success     BOOLEAN;
  v_event_data  JSONB;
  v_id          UUID;
  v_key         TEXT;
  v_safe        JSONB := '{}'::jsonb;
BEGIN
  IF p_event_type IS NULL OR p_event_type NOT IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink',
    'payment_retry'
  ) THEN
    RAISE EXCEPTION 'invalid event_type: %', p_event_type
      USING ERRCODE = '22023';
  END IF;

  v_success := COALESCE(p_success, TRUE);
  v_event := p_event_type;
  IF v_event = 'sign_in' AND v_success IS FALSE THEN
    v_event := 'sign_in_failed';
  ELSIF v_event = 'sign_in' AND v_success IS TRUE THEN
    v_event := 'sign_in_success';
  END IF;

  -- Strip credential-ish keys from event_data (defense in depth).
  IF p_event_data IS NOT NULL AND jsonb_typeof(p_event_data) = 'object' THEN
    FOR v_key IN SELECT jsonb_object_keys(p_event_data)
    LOOP
      IF v_key !~* '(password|token|secret|key|credential)' THEN
        v_safe := v_safe || jsonb_build_object(v_key, p_event_data -> v_key);
      END IF;
    END LOOP;
    v_event_data := NULLIF(v_safe, '{}'::jsonb);
  ELSE
    v_event_data := p_event_data;
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  v_ip_raw := NULLIF(trim(COALESCE(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)
  )), '');

  IF v_ip_raw IS NOT NULL THEN
    BEGIN
      v_ip := v_ip_raw::inet;
    EXCEPTION WHEN OTHERS THEN
      v_ip := NULL;
    END;
  END IF;

  v_ua := left(
    NULLIF(trim(COALESCE(v_headers ->> 'user-agent', p_user_agent)), ''),
    500
  );

  INSERT INTO auth_audit_logs (
    user_id,
    event_type,
    event_data,
    ip_address,
    user_agent,
    success,
    error_message
  ) VALUES (
    p_user_id,
    v_event,
    v_event_data,
    v_ip,
    v_ua,
    v_success,
    NULLIF(p_error_message, '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_auth_audit_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT) IS
  'Client-callable auth audit insert (#304). Derives IP/UA from PostgREST request.headers; SECURITY DEFINER bypasses service_role-only INSERT RLS.';

REVOKE ALL ON FUNCTION log_auth_audit_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_auth_audit_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION log_auth_audit_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_auth_audit_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT) TO service_role;

-- Rate limiting check (Feature 017)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limit_attempts%ROWTYPE;
  -- Per-email failed-attempt cap. Raised 5 -> 15 in #81 (ratified in #198) so
  -- Supabase Auth's separate IP-level 429 bucket can no longer burn a user's
  -- per-email budget. MUST stay in sync with AUTH_RATE_LIMIT_MAX_ATTEMPTS in
  -- src/lib/auth/rate-limit-check.ts (a unit test enforces this) and with
  -- FR-016 in features/foundation/003-user-authentication/spec.md.
  v_max_attempts INTEGER := 15;
  v_window_minutes INTEGER := 15;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type
  FOR UPDATE SKIP LOCKED;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_record.locked_until, 'reason', 'rate_limited');
  END IF;

  IF v_record.id IS NULL OR (v_now - v_record.window_start) > (v_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, window_start, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, v_now, 0)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET window_start = v_now, attempt_count = 0, locked_until = NULL, updated_at = v_now;
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts, 'locked_until', NULL);
  END IF;

  IF v_record.attempt_count < v_max_attempts THEN
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts - v_record.attempt_count, 'locked_until', NULL);
  ELSE
    UPDATE rate_limit_attempts
    SET locked_until = v_now + (v_window_minutes || ' minutes')::INTERVAL, updated_at = v_now
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_now + (v_window_minutes || ' minutes')::INTERVAL, 'reason', 'rate_limited');
  END IF;
END;
$$;

-- Record failed auth attempt (Feature 017)
CREATE OR REPLACE FUNCTION record_failed_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rate_limit_attempts
  SET attempt_count = attempt_count + 1, updated_at = now(), ip_address = COALESCE(p_ip_address, ip_address)
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type;

  IF NOT FOUND THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, 1)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET attempt_count = rate_limit_attempts.attempt_count + 1, updated_at = now();
  END IF;
END;
$$;

-- ============================================================================
-- PART 5: TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ============================================================================
-- PART 6: STORAGE BUCKETS (Feature 022: Avatar Upload)
-- ============================================================================

-- Create avatars bucket for user profile pictures
--
-- Local-profile caveat: the supabase/postgres image's storage-schema.sql
-- creates storage.buckets with only (id, name, owner, created_at, updated_at).
-- The public / file_size_limit / allowed_mime_types columns are added by the
-- storage SERVICE's own runtime migrations on first connect -- which can't
-- happen during initdb because storage hasn't started yet. Against Supabase
-- Cloud this INSERT works as-is because storage has already migrated there.
-- Forward-fill the three columns here so the INSERT succeeds; storage's own
-- ADD COLUMN IF NOT EXISTS will no-op when it catches up later.
--
-- Cloud-portability guard: on hosted Supabase these columns ALREADY exist and
-- storage tables are owned by supabase_storage_admin — running the bare ALTERs
-- as the `postgres` role (SQL Editor, MCP) throws 42501 "must be owner of
-- table buckets" and aborts the whole transaction. Swallow the privilege error:
-- it only occurs in exactly the environment where the columns already exist.
DO $$
BEGIN
  ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public             boolean DEFAULT false;
  ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS file_size_limit    bigint;
  ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS allowed_mime_types text[];
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- hosted Supabase: columns pre-exist, nothing to forward-fill
END $$;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,                                              -- Public read access
  5242880,                                           -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp']    -- Allowed formats
)
ON CONFLICT (id) DO NOTHING;                         -- Idempotent

-- Pet photos bucket (#110) — public read; staff write policies live with
-- rescue RLS (after is_shelter_staff exists) so initdb ordering stays safe.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing avatar policies (for clean re-run)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- These three policies used to read:  auth.uid()::text = (storage.foldername(name))[1]
-- That expression creates a pg_depend edge on storage.foldername(text). On Cloud nobody
-- cares because storage-api has already run its storage-schema migration by
-- the time anybody applies app schema. On a fresh local initdb the ordering is
-- inverted: this file runs first, pins the base-image foldername, then
-- storage-api connects and tries DROP FUNCTION foldername(text) to install its
-- canonical version -- and can't, because our three policies depend on it.
-- storage-api crash-loops on "cannot drop function foldername(text) because
-- other objects depend on it" forever.
--
-- split_part(name, '/', 1) is the same thing -- first path segment -- using
-- only pg_catalog built-ins. No pg_depend edge, storage-api free to DROP.
-- Edge cases land identically for policy purposes: bare filename with no '/'
-- produces NULL vs the filename itself, but auth.uid() = NULL and
-- auth.uid() = 'avatar.png' both DENY (uuids can't collide with filenames).

-- Avatar RLS Policy 1: INSERT - Users can upload own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 2: UPDATE - Users can update own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 3: DELETE - Users can delete own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 4: SELECT - Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- PART 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;
-- Edge-function idempotency cache (#46 / advisor rls_disabled_in_public).
-- Service-role only (Edge Functions); no policies → deny anon/authenticated.
-- service_role bypasses RLS.
ALTER TABLE edge_idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE edge_idempotency_keys FROM anon, authenticated;

-- Payment intents (Feature 017: Stricter policies)
DROP POLICY IF EXISTS "Users can view own payment intents" ON payment_intents;
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users can create own payment intents" ON payment_intents;
CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Payment intents are immutable" ON payment_intents;
CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment intents cannot be deleted by users" ON payment_intents;
CREATE POLICY "Payment intents cannot be deleted by users" ON payment_intents
  FOR DELETE USING (false);

-- Payment results (Feature 017: Stricter policies)
DROP POLICY IF EXISTS "Users can view own payment results" ON payment_results;
CREATE POLICY "Users can view own payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can insert payment results" ON payment_results;
CREATE POLICY "Service role can insert payment results" ON payment_results
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Payment results are immutable" ON payment_results;
CREATE POLICY "Payment results are immutable" ON payment_results
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment results cannot be deleted by users" ON payment_results;
CREATE POLICY "Payment results cannot be deleted by users" ON payment_results
  FOR DELETE USING (false);

-- Subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users create own subscriptions" ON subscriptions;
CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users update own subscriptions" ON subscriptions;
CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = template_user_id);

-- Webhook events
DROP POLICY IF EXISTS "Service creates webhook events" ON webhook_events;
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service updates webhook events" ON webhook_events;
CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE TO service_role WITH CHECK (true);

-- Payment provider config
DROP POLICY IF EXISTS "Users view provider config" ON payment_provider_config;
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT USING (true);

-- User profiles
-- Note: "Users view own profile" provides full access to own profile
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Note: "Authenticated users can search profiles" enables Feature 023 friend search
-- Users can view public profile fields (username, display_name, avatar_url) to find friends
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON user_profiles;
CREATE POLICY "Authenticated users can search profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service creates profiles" ON user_profiles;
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Auth audit logs (Feature 017)
DROP POLICY IF EXISTS "Users can view own audit logs" ON auth_audit_logs;
CREATE POLICY "Users can view own audit logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON auth_audit_logs;
CREATE POLICY "Service role can insert audit logs" ON auth_audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- Admin read-only policies (Feature: Admin Dashboard)
-- Uses JWT custom claims from auth.users.raw_app_meta_data (Supabase RBAC best practice)
-- NEVER subquery user_profiles from its own policy — causes infinite recursion
-- Admin status is set via: UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
--
-- Local-profile caveat: the supabase/postgres image ships auth.uid/role/email
-- (init-scripts/00000000000001-auth-schema.sql) but NOT auth.jwt -- GoTrue
-- creates that on its own first boot. CREATE POLICY checks function existence
-- at parse time, not call time, so every policy below would fail during local
-- initdb. Forward-fill a stub with the canonical implementation; GoTrue's
-- CREATE OR REPLACE overwrites it at service boot. Ownership must be
-- supabase_auth_admin or that REPLACE dies on 42501 (must be owner).
--
-- Cloud-portability guard: on hosted Supabase GoTrue's canonical auth.jwt()
-- ALREADY exists and is owned by supabase_auth_admin — a bare CREATE OR
-- REPLACE as the `postgres` role (SQL Editor, MCP) throws 42501 "must be
-- owner" and aborts the whole transaction. Only forward-fill when the
-- function is genuinely missing (local initdb), and swallow the privilege
-- error otherwise: it only occurs where the canonical function already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'jwt'
  ) THEN
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $fn$
      SELECT coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
      )::jsonb
    $fn$;
    ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- hosted Supabase: GoTrue's auth.jwt() already in place
END $$;

DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
CREATE POLICY "Admin can view all profiles" ON user_profiles
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all audit logs" ON auth_audit_logs;
CREATE POLICY "Admin can view all audit logs" ON auth_audit_logs
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all payment intents" ON payment_intents;
CREATE POLICY "Admin can view all payment intents" ON payment_intents
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all payment results" ON payment_results;
CREATE POLICY "Admin can view all payment results" ON payment_results
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all rate limits" ON rate_limit_attempts;
CREATE POLICY "Admin can view all rate limits" ON rate_limit_attempts
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

-- The three admin-read policies for user_connections / conversations / messages
-- belong with this block semantically but live ~400 lines down, right after
-- the messages section finishes. Those tables are created in PART 8; placing
-- the policies here would be a forward reference that crashes on a fresh
-- local initdb (relation does not exist). On Cloud the tables already exist
-- from prior runs so nobody noticed. Grep for "Admin can view all connections".

-- ============================================================================
-- Admin RPC Aggregation Functions (Feature: Admin Dashboard)
-- SECURITY INVOKER: runs as calling user, respects RLS
-- ============================================================================

-- admin_payment_stats(): Payment metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_payment_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_payments', (SELECT count(*) FROM payment_results),
      'successful_payments', (SELECT count(*) FROM payment_results WHERE status = 'succeeded'),
      'failed_payments', (SELECT count(*) FROM payment_results WHERE status = 'failed'),
      'pending_payments', (SELECT count(*) FROM payment_results WHERE status = 'pending'),
      'total_revenue_cents', (SELECT COALESCE(sum(charged_amount), 0) FROM payment_results WHERE status = 'succeeded'),
      'active_subscriptions', (SELECT count(*) FROM subscriptions WHERE status = 'active'),
      'failed_this_week', (SELECT count(*) FROM payment_results WHERE status = 'failed' AND created_at > now() - interval '7 days'),
      -- json_object_agg keys on provider so the wire shape matches
      -- AdminPaymentStats.revenue_by_provider: Record<string, number>.
      -- json_agg(row_to_json(...)) here used to emit an array — every unit
      -- mock used the Record shape so the mismatch only surfaced live.
      'revenue_by_provider', (
        SELECT COALESCE(json_object_agg(provider, total), '{}'::json)
        FROM (
          SELECT provider, sum(charged_amount) AS total
          FROM payment_results
          WHERE status = 'succeeded'
          GROUP BY provider
        ) t
      )
    )
  );
END;
$$;

-- admin_auth_stats(): Auth/security metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_auth_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'logins_today', (SELECT count(*) FROM auth_audit_logs WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE AND created_at > now() - interval '1 day'),
      'failed_this_week', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_in_failed' AND created_at > now() - interval '7 days'),
      'signups_this_month', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_up' AND success = TRUE AND created_at > now() - interval '30 days'),
      'rate_limited_users', (SELECT count(*) FROM rate_limit_attempts WHERE locked_until IS NOT NULL AND locked_until > now()),
      'top_failed_logins', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          -- 'attempts' matches AdminAuthStats.top_failed_logins[].attempts
          -- and AuditBurst.attempts — same semantic, one name.
          SELECT user_id, count(*) AS attempts
          FROM auth_audit_logs
          WHERE event_type = 'sign_in_failed'
            AND created_at > now() - interval '7 days'
          GROUP BY user_id
          ORDER BY attempts DESC
          LIMIT 10
        ) t
      )
    )
  );
END;
$$;

-- admin_user_stats(): User metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_users', (SELECT count(*) FROM user_profiles WHERE is_admin = FALSE),
      'active_this_week', (SELECT count(*) FROM user_profiles WHERE updated_at > now() - interval '7 days' AND is_admin = FALSE),
      'pending_connections', (SELECT count(*) FROM user_connections WHERE status = 'pending'),
      'total_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted')
    )
  );
END;
$$;

-- admin_messaging_stats(): Messaging metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_messaging_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_conversations', (SELECT count(*) FROM conversations),
      'group_conversations', (SELECT count(*) FROM conversations WHERE is_group = TRUE),
      'direct_conversations', (SELECT count(*) FROM conversations WHERE is_group = FALSE),
      'messages_this_week', (SELECT count(*) FROM messages WHERE created_at > now() - interval '7 days'),
      'active_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted'),
      'blocked_connections', (SELECT count(*) FROM user_connections WHERE status = 'blocked'),
      -- json_object_agg keys on status so Object.entries() at
      -- AdminMessagingOverview.tsx gets {accepted: N, pending: M, ...}
      -- not [{status, total}]. Empty case → {} not [].
      'connection_distribution', (
        SELECT COALESCE(json_object_agg(status, total), '{}'::json)
        FROM (
          SELECT status, count(*) AS total
          FROM user_connections
          GROUP BY status
        ) t
      )
    )
  );
END;
$$;

-- admin_list_users(p_search, p_limit, p_offset): User listing for admin dashboard
--
-- SECURITY DEFINER: auth.users.last_sign_in_at is the activity truth source and
-- is NOT reachable through RLS from the client. The JWT guard is the only gate.
--
-- activity is computed in SQL so the admin stats and this listing agree on what
-- "active" means — same 7-day boundary as admin_user_stats.active_this_week.
-- NULL last_sign_in_at (signed up but never returned) folds into dormant.
--
-- Search covers both username and display_name. Leading-wildcard ILIKE won't hit
-- the btree index on username but at admin-dashboard scale this is a non-issue.
--
-- Returns {total, users[]} — total is the search-filtered count ignoring
-- limit/offset, so the UI can render "showing N of M" without a second call.
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 50,
  p_offset INT  DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern TEXT;
  v_total   BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Build once, reuse twice. NULL pattern → no filter (short-circuited below).
  v_pattern := '%' || p_search || '%';

  SELECT COUNT(*) INTO v_total
  FROM user_profiles p
  WHERE p.is_admin = FALSE
    AND (p_search IS NULL
         OR p.username     ILIKE v_pattern
         OR p.display_name ILIKE v_pattern);

  RETURN json_build_object(
    'total', v_total,
    'users', COALESCE((
      SELECT json_agg(row_to_json(u))
      FROM (
        SELECT
          p.id,
          p.username,
          p.display_name,
          p.created_at,
          p.welcome_message_sent,
          au.last_sign_in_at,
          CASE
            WHEN au.last_sign_in_at IS NULL                           THEN 'dormant'
            WHEN au.last_sign_in_at > now() - interval '7 days'       THEN 'active'
            WHEN au.last_sign_in_at > now() - interval '30 days'      THEN 'idle'
            ELSE 'dormant'
          END AS activity
        FROM user_profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.is_admin = FALSE
          AND (p_search IS NULL
               OR p.username     ILIKE v_pattern
               OR p.display_name ILIKE v_pattern)
        ORDER BY au.last_sign_in_at DESC NULLS LAST, p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) u
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_list_users(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, INT, INT) TO authenticated;

-- admin_payment_trends(p_start, p_end): Date-ranged payment breakdown for admin dashboard
--
-- SECURITY DEFINER: bypasses RLS by design. The JWT guard on the first line is the
-- ONLY access check — non-admin callers get {} and never reach the aggregation.
-- This is the pattern for admin aggregates that must work even on tables where
-- the admin has no row-level SELECT policy (see: messaging). payment_results
-- happens to have an admin RLS policy too, but this function does not rely on it.
--
-- Refund rate = refunded / succeeded (0 when succeeded = 0, no NaN).
-- daily_series is DENSE: generate_series emits every day in range, LEFT JOIN fills
-- gaps with zeros. Charts can render directly without client-side gap-filling.
CREATE OR REPLACE FUNCTION admin_payment_trends(
  p_start TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end   TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_succeeded     BIGINT;
  v_failed        BIGINT;
  v_refunded      BIGINT;
  v_revenue_cents BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Single pass over the range for totals. COUNT/SUM over a condition are
  -- expressed with FILTER so the planner scans payment_results once.
  SELECT
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'refunded'),
    COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0)
  INTO v_succeeded, v_failed, v_refunded, v_revenue_cents
  FROM payment_results
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'succeeded',     v_succeeded,
      'failed',        v_failed,
      'refunded',      v_refunded,
      'revenue_cents', v_revenue_cents
    ),
    'refund_rate', CASE
      WHEN v_succeeded = 0 THEN 0
      ELSE round(v_refunded::numeric / v_succeeded::numeric, 4)
    END,
    'provider_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.revenue_cents DESC), '[]'::json)
      FROM (
        SELECT
          provider,
          COUNT(*) FILTER (WHERE status = 'succeeded')                        AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')                           AS failed,
          COUNT(*) FILTER (WHERE status = 'refunded')                         AS refunded,
          COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
        FROM payment_results
        WHERE created_at >= p_start AND created_at < p_end
        GROUP BY provider
      ) p
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')               AS day,
          COALESCE(agg.succeeded, 0)                    AS succeeded,
          COALESCE(agg.failed, 0)                       AS failed,
          COALESCE(agg.revenue_cents, 0)                AS revenue_cents
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                        AS day,
            COUNT(*) FILTER (WHERE status = 'succeeded')                         AS succeeded,
            COUNT(*) FILTER (WHERE status = 'failed')                            AS failed,
            COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
          FROM payment_results
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- admin_audit_trends(p_start, p_end, ...): Failed-login burst detection for admin dashboard
--
-- SECURITY DEFINER: JWT guard is the only gate. auth_audit_logs happens to have an
-- admin RLS policy, but this function does not rely on it — same pattern as
-- admin_payment_trends so messaging aggregates can follow without an RLS policy.
--
-- Bursts (gaps-and-islands): a burst is a contiguous run of sign_in_failed rows
-- from one IP where no two consecutive attempts are more than p_burst_gap apart.
-- LAG finds gaps, cumulative SUM assigns a burst_id, GROUP BY (ip, burst_id)
-- collapses each run, HAVING count >= p_burst_min_attempts keeps the meaningful ones.
-- An IP that fails once on Monday and 12 times in a tight cluster on Friday yields
-- ONE burst (Friday), not a misleading 5-day span.
--
-- distinct_users disambiguates: 1 = targeted account, many = credential stuffing.
-- COUNT(DISTINCT user_id) ignores NULL, which is correct — failed logins against
-- unknown emails have user_id=NULL and shouldn't inflate the distinct count.
CREATE OR REPLACE FUNCTION admin_audit_trends(
  p_start              TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end                TIMESTAMPTZ DEFAULT now(),
  p_burst_min_attempts INT         DEFAULT 5,
  p_burst_gap          INTERVAL    DEFAULT interval '10 minutes'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed    BIGINT;
  v_succeeded BIGINT;
  v_bursts    JSON;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Totals: single scan over the range, FILTER for multi-count
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'sign_in_failed'),
    COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE)
  INTO v_failed, v_succeeded
  FROM auth_audit_logs
  WHERE created_at >= p_start AND created_at < p_end;

  -- Burst sessionization. The first row per IP has LAG=NULL → NULL > interval
  -- is NULL → CASE falls through to 0, so burst_id starts at 0 per IP. Correct.
  WITH failed AS (
    SELECT ip_address, user_id, created_at
    FROM auth_audit_logs
    WHERE event_type = 'sign_in_failed'
      AND ip_address IS NOT NULL
      AND created_at >= p_start AND created_at < p_end
  ),
  gapped AS (
    SELECT *,
      CASE
        WHEN created_at - LAG(created_at) OVER (
          PARTITION BY ip_address ORDER BY created_at
        ) > p_burst_gap
        THEN 1 ELSE 0
      END AS gap
    FROM failed
  ),
  bursted AS (
    SELECT *,
      SUM(gap) OVER (PARTITION BY ip_address ORDER BY created_at) AS burst_id
    FROM gapped
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY b.attempts DESC), '[]'::json)
  INTO v_bursts
  FROM (
    SELECT
      host(ip_address)             AS ip_address,
      MIN(created_at)              AS first_seen,
      MAX(created_at)              AS last_seen,
      COUNT(*)::int                AS attempts,
      COUNT(DISTINCT user_id)::int AS distinct_users
    FROM bursted
    GROUP BY ip_address, burst_id
    HAVING COUNT(*) >= p_burst_min_attempts
  ) b;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'sign_in_failed',  v_failed,
      'sign_in_success', v_succeeded,
      'bursts',          COALESCE(json_array_length(v_bursts), 0)
    ),
    'bursts', v_bursts,
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS day,
          COALESCE(agg.failed, 0)         AS failed,
          COALESCE(agg.succeeded, 0)      AS succeeded
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                                           AS day,
            COUNT(*) FILTER (WHERE event_type = 'sign_in_failed')                                   AS failed,
            COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE) AS succeeded
          FROM auth_audit_logs
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) TO authenticated;

-- admin_messaging_trends(p_start, p_end, p_top_limit): Messaging volume for admin dashboard
--
-- SECURITY DEFINER: messages RLS is participant-only. Admin is not a
-- participant in most conversations, so counting rows at all requires
-- bypassing RLS. The JWT guard is the only gate.
--
-- THE ENCRYPTION BOUNDARY:
-- messages.encrypted_content and messages.initialization_vector are NEVER
-- named in this function. Column lists are explicit — no SELECT * anywhere.
-- conversation_id is also excluded from output: emitting {user_id,
-- conversation_id, count} would let an admin reconstruct the social graph
-- by correlating rows. {user_id, count} alone is traffic volume, not
-- who-talks-to-whom. Count and trend, not decrypt and display.
--
-- deleted messages are filtered out — a burst of sends-then-deletes is a
-- user decision we shouldn't surface as "volume" in the admin view.
--
-- daily_series is dense (generate_series spine, two LEFT JOINs) so the UI
-- gets a contiguous x-axis even on zero-traffic days.
CREATE OR REPLACE FUNCTION admin_messaging_trends(
  p_start     TIMESTAMPTZ DEFAULT now() - interval '7 days',
  p_end       TIMESTAMPTZ DEFAULT now(),
  p_top_limit INT         DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages       BIGINT;
  v_active_senders BIGINT;
  v_convs_created  BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Message totals: one scan, two facts. Only sender_id/created_at/deleted
  -- touched — the ciphertext columns are not in this query at any layer.
  SELECT COUNT(*), COUNT(DISTINCT sender_id)
  INTO v_messages, v_active_senders
  FROM messages
  WHERE deleted = FALSE
    AND created_at >= p_start AND created_at < p_end;

  SELECT COUNT(*) INTO v_convs_created
  FROM conversations
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'messages',              v_messages,
      'conversations_created', v_convs_created,
      'active_senders',        v_active_senders
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')   AS day,
          COALESCE(m.messages, 0)           AS messages,
          COALESCE(c.conversations_created, 0) AS conversations_created
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS messages
          FROM messages
          WHERE deleted = FALSE
            AND created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) m ON m.day = days.day
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS conversations_created
          FROM conversations
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) c ON c.day = days.day
      ) d
    ),
    'top_senders', (
      -- user_id + aggregate count only. No conversation_id, no recipient
      -- dimension. The admin sees WHO is noisy, not who they're noisy AT.
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT
          msg.sender_id  AS user_id,
          p.username     AS username,
          p.display_name AS display_name,
          COUNT(*)::int  AS messages
        FROM messages msg
        JOIN user_profiles p ON p.id = msg.sender_id
        WHERE msg.deleted = FALSE
          AND msg.created_at >= p_start AND msg.created_at < p_end
          AND p.is_admin = FALSE
        GROUP BY msg.sender_id, p.username, p.display_name
        ORDER BY COUNT(*) DESC
        LIMIT p_top_limit
      ) s
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- admin_conversation_list(p_limit, p_offset): Per-conversation metadata
--
-- The trends RPC above deliberately omits conversation_id to prevent
-- social-graph reconstruction from {sender, conversation, count} tuples.
-- This function crosses that line on purpose — per-row drill-down is
-- needed to spot spam floods and dead channels — but holds a weaker
-- boundary: conversation_id + counts + timestamps, NO participant IDs,
-- NO group_name. The admin sees "conversation abc has 800 messages", not
-- "Alice and Bob have 800 messages".
--
-- participant_count: the check_group_participants constraint guarantees
-- both participant columns are NOT NULL for is_group=FALSE, so direct
-- chats are hard-coded to 2. Groups count active conversation_members.
--
-- message_count: non-deleted, non-system. 'member_joined' etc. are
-- protocol noise, not user traffic.
--
-- SECURITY DEFINER: conversations RLS is participant-only and admins are
-- not participants. Same JWT gate as the other admin functions. The
-- DEFINER privilege is spent only on the SELECTs below, which name
-- metadata columns explicitly — encrypted_content and
-- initialization_vector appear nowhere.
--
-- Returns {total, conversations[]} so the caller gets "showing N of M"
-- without a second round-trip. Same shape as admin_list_users.
CREATE OR REPLACE FUNCTION admin_conversation_list(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM conversations),
    'conversations', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT
          conv.id                                         AS conversation_id,
          conv.is_group                                   AS is_group,
          CASE
            WHEN conv.is_group THEN COALESCE(cm.active_members, 0)::int
            ELSE 2
          END                                             AS participant_count,
          COALESCE(m.message_count, 0)::int               AS message_count,
          COALESCE(conv.last_message_at, conv.created_at) AS last_activity,
          conv.created_at                                 AS created_at
        FROM conversations conv
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS message_count
          FROM messages
          WHERE deleted = FALSE AND is_system_message = FALSE
          GROUP BY conversation_id
        ) m ON m.conversation_id = conv.id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS active_members
          FROM conversation_members
          WHERE left_at IS NULL
          GROUP BY conversation_id
        ) cm ON cm.conversation_id = conv.id
        ORDER BY COALESCE(conv.last_message_at, conv.created_at) DESC
        LIMIT p_limit OFFSET p_offset
      ) c
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_conversation_list(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_conversation_list(INT, INT) TO authenticated;

-- admin_overview(p_start, p_end): Composite dashboard payload — one round-trip, all four domains
--
-- Calls the four existing *_stats() functions server-side rather than
-- re-aggregating. Those functions are SECURITY INVOKER, but auth.jwt()
-- reads from request context not function security mode, so their JWT
-- guards still gate correctly when called from inside this DEFINER body.
-- The win: when admin_payment_stats changes, the overview inherits it.
--
-- sparks: four integer arrays, one point per day in [v_start, v_end],
-- oldest → newest, zero-filled. Plain arrays (not [{day, value}] objects)
-- because the sparkline SVG index-maps x — it doesn't need the dates.
-- Default 7 ticks; a 30-day range produces 30-element arrays and the
-- Sparkline just draws a denser polyline. One generate_series spine,
-- four LEFT JOINs.
--
-- DEFINER because the messages spark crosses RLS. user_profiles spark
-- (signups) and payment_results spark would work under INVOKER with the
-- admin's RLS policies, but making the whole function DEFINER keeps the
-- composition uniform. The JWT check is the only gate.
--
-- DROP the zero-arg overload first. PG identifies functions by name+argtypes,
-- so CREATE OR REPLACE admin_overview(p_start, p_end) doesn't touch
-- admin_overview(). With both in pg_proc, PostgREST returns 300 Multiple
-- Choices when called with {} since both overloads satisfy all-defaults.
DROP FUNCTION IF EXISTS admin_overview();

CREATE OR REPLACE FUNCTION admin_overview(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Day-truncate whatever bounds we got so the spine walks whole days.
  -- NULL defaults COALESCE to the original [today-6, today] 7-tick window
  -- — NOT the *_trends pattern of now()-7d..now() which truncates to 8
  -- ticks depending on time-of-day. v_end resolves before v_start reads it.
  v_end   := date_trunc('day', COALESCE(p_end, now()));
  v_start := date_trunc('day', COALESCE(p_start, v_end - interval '6 days'));

  RETURN json_build_object(
    -- Echo the window the SQL actually used (post-COALESCE, post-trunc)
    -- so the UI knows what range it's showing when the caller omitted
    -- bounds. Same key as the *_trends RPCs.
    'range', json_build_object('start', v_start, 'end', v_end),

    'payments',  admin_payment_stats(),
    'auth',      admin_auth_stats(),
    'users',     admin_user_stats(),
    'messaging', admin_messaging_stats(),

    'sparks', (
      -- Half-open range on each subquery: [day, day+1). Next-day traffic
      -- doesn't bleed into today's bucket. ORDER BY days.day is load-bearing
      -- — json_agg without it would emit whatever hash order the joins land
      -- in and the sparkline would render scrambled.
      SELECT json_build_object(
        'payments', json_agg(COALESCE(p.n, 0)  ORDER BY days.day),
        'logins',   json_agg(COALESCE(a.n, 0)  ORDER BY days.day),
        'signups',  json_agg(COALESCE(u.n, 0)  ORDER BY days.day),
        'messages', json_agg(COALESCE(m.n, 0)  ORDER BY days.day)
      )
      FROM generate_series(v_start, v_end, interval '1 day') AS days(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM payment_results
        WHERE status = 'succeeded'
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) p ON p.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM auth_audit_logs
        WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) a ON a.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM user_profiles
        WHERE is_admin = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) u ON u.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM messages
        WHERE deleted = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) m ON m.day = days.day
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

-- Authenticated users
GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated;
GRANT SELECT ON payment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO authenticated;
GRANT SELECT ON payment_provider_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON auth_audit_logs TO authenticated;

-- Service role (full access)
GRANT ALL ON payment_intents TO service_role;
GRANT ALL ON payment_results TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON payment_provider_config TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth_audit_logs TO service_role;

-- ============================================================================
-- PART 8: SEED TEST USER (Primary)
-- ============================================================================
-- Creates: test@example.com / TestPassword123!
-- Email is already confirmed (bypasses verification requirement)
-- Note: User was deleted at start of script for idempotency
--
-- Local-profile caveat: this whole block is wrapped in a DO/EXCEPTION guard.
-- On Supabase Cloud it runs exactly as before -- nothing throws, the handler
-- never fires. On a fresh local initdb it soft-skips, because at this point
-- in the boot GoTrue has not yet connected and run its ~40 numbered runtime
-- migrations. Two things are missing that this INSERT needs:
--
--   (1) auth.users.email_confirmed_at and .email_change_token_new -- the base
--       image ships the original 2016-era column names (confirmed_at,
--       email_change_token). GoTrue's migrations rename/add these later.
--   (2) auth.identities -- the whole table. Zero hits for "identities" in the
--       base image's initdb.d/. GoTrue creates it on first connect.
--
-- Unlike the storage.buckets and auth.jwt() forward-fills elsewhere in this
-- file, forward-filling here would BREAK GoTrue: its numbered migrations are
-- tracked in auth.schema_migrations and have no IF NOT EXISTS guards, so a
-- pre-existing email_confirmed_at column or identities table makes GoTrue's
-- own ADD COLUMN / CREATE TABLE crash on 42701/42P07. The DO/EXCEPTION wrap
-- is the only shape that is a no-op in both directions.
--
-- Local seeding is handled post-boot by scripts/seed-test-users.ts via the
-- admin API, after GoTrue has migrated itself. Nothing is lost.

DO $seed_test_user$
BEGIN
  -- Create the user in auth.users with confirmed email
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'test@example.com',
    crypt('TestPassword123!', gen_salt('bf')),  -- Hashed password using bcrypt
    now(),  -- Email already confirmed
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  -- Create identity record (required for Supabase Auth)
  INSERT INTO auth.identities (
    provider_id,
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    id,
    gen_random_uuid(),
    id,
    jsonb_build_object('sub', id::text, 'email', email),
    'email',
    now(),
    now(),
    now()
  FROM auth.users
  WHERE email = 'test@example.com';

EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE
      'Skipping test-user seed (GoTrue has not migrated auth schema yet: %). '
      'On the local profile this is expected -- run scripts/seed-test-users.ts '
      'after the stack is healthy.', SQLERRM;
END
$seed_test_user$;

-- ============================================================================
-- PART 9: USER MESSAGING SYSTEM (PRP-023)
-- ============================================================================
-- End-to-end encrypted messaging with friend requests
-- Features: Zero-knowledge E2E encryption, real-time delivery, typing indicators
-- Tables: 6 (user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators)

-- Table 1: user_connections (Friend requests)
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_id != addressee_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_connections_requester ON user_connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_addressee ON user_connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own connections" ON user_connections;
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON user_connections;
CREATE POLICY "Users can create friend requests" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Addressee can update connection status" ON user_connections;
CREATE POLICY "Addressee can update connection status" ON user_connections
  FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can delete own sent requests" ON user_connections;
CREATE POLICY "Users can delete own sent requests" ON user_connections
  FOR DELETE USING (auth.uid() = requester_id AND status = 'pending');

COMMENT ON TABLE user_connections IS 'Friend request management with status tracking';

-- Table 2: conversations (1-to-1 chats)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  archived_by_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
  archived_by_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_conversation CHECK (participant_1_id != participant_2_id),
  CONSTRAINT canonical_ordering CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(participant_1_id, archived_by_participant_1, participant_2_id, archived_by_participant_2);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

DROP POLICY IF EXISTS "Users can create conversations with connections" ON conversations;
CREATE POLICY "Users can create conversations with connections" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted' AND (
        (requester_id = participant_1_id AND addressee_id = participant_2_id) OR
        (requester_id = participant_2_id AND addressee_id = participant_1_id)
      )
    )
  );

-- Admin can create conversations with any user (Feature 002 - welcome messages)
DROP POLICY IF EXISTS "Admin can create any conversation" ON conversations;
CREATE POLICY "Admin can create any conversation" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Users can create conversations with admin for welcome messages (Feature 004)
-- This allows the client-side welcome service to create the conversation
DROP POLICY IF EXISTS "Users can create conversation with admin" ON conversations;
CREATE POLICY "Users can create conversation with admin" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    (participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid OR
     participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid)
  );

DROP POLICY IF EXISTS "System can update last_message_at" ON conversations;
CREATE POLICY "System can update last_message_at" ON conversations
  FOR UPDATE TO service_role USING (true);

-- Allow users to archive/unarchive their own conversations
DROP POLICY IF EXISTS "Users can update own conversation archive status" ON conversations;
CREATE POLICY "Users can update own conversation archive status" ON conversations
  FOR UPDATE USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

COMMENT ON TABLE conversations IS '1-to-1 conversations with canonical ordering';

-- Table 3: messages (Encrypted content)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  initialization_vector TEXT NOT NULL,
  sequence_number BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Note: sender_is_participant validation enforced by RLS policy, not CHECK constraint
  -- (PostgreSQL doesn't allow subqueries in CHECK constraints)
  CONSTRAINT unique_sequence UNIQUE (conversation_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(read_at) WHERE read_at IS NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert welcome messages from admin (Feature 004)
-- Allows client-side welcome service to insert message with sender_id = admin
-- Only allowed in conversations where user is a participant with admin
DROP POLICY IF EXISTS "Users can insert welcome message from admin" ON messages;
CREATE POLICY "Users can insert welcome message from admin" ON messages
  FOR INSERT WITH CHECK (
    sender_id = '00000000-0000-0000-0000-000000000001'::uuid AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        (conversations.participant_1_id = auth.uid() AND
         conversations.participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid) OR
        (conversations.participant_2_id = auth.uid() AND
         conversations.participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Users can edit own messages" ON messages;
CREATE POLICY "Users can edit own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND created_at > now() - INTERVAL '15 minutes');

-- Allow recipients to mark messages as read (update read_at field)
-- This is separate from edit policy because recipients need to update messages they didn't send
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
CREATE POLICY "Recipients can mark messages as read" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  );

DROP POLICY IF EXISTS "Users cannot delete messages" ON messages;
CREATE POLICY "Users cannot delete messages" ON messages
  FOR DELETE USING (false);

-- Admin dashboard read-only policies for the three messaging tables. These
-- belong semantically with the other admin policies up in PART 7 (~line 608)
-- but can't live there: user_connections / conversations / messages are
-- forward references until this point. On Cloud nobody noticed because the
-- tables persist across re-runs; on a fresh local initdb this was crash #3.
DROP POLICY IF EXISTS "Admin can view all connections" ON user_connections;
CREATE POLICY "Admin can view all connections" ON user_connections
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view conversation metadata" ON conversations;
CREATE POLICY "Admin can view conversation metadata" ON conversations
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view message metadata" ON messages;
CREATE POLICY "Admin can view message metadata" ON messages
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

COMMENT ON TABLE messages IS 'E2E encrypted messages with 15-minute edit window';

-- Table 4: user_encryption_keys (Public ECDH keys + password-derived salt)
-- encryption_salt: Base64-encoded 16-byte Argon2 salt for password-derived keys
-- NULL salt indicates legacy random-generated keys requiring migration (Feature 032)
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,
  encryption_salt TEXT, -- Base64 Argon2 salt (NULL = legacy keys)
  device_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_user ON user_encryption_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_active ON user_encryption_keys(user_id, revoked, expires_at)
  WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_salt ON user_encryption_keys(user_id)
  WHERE encryption_salt IS NOT NULL;

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public keys" ON user_encryption_keys;
CREATE POLICY "Anyone can view public keys" ON user_encryption_keys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own keys" ON user_encryption_keys;
CREATE POLICY "Users can create own keys" ON user_encryption_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke own keys" ON user_encryption_keys;
CREATE POLICY "Users can revoke own keys" ON user_encryption_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cannot delete keys" ON user_encryption_keys;
CREATE POLICY "Users cannot delete keys" ON user_encryption_keys
  FOR DELETE USING (false);

COMMENT ON TABLE user_encryption_keys IS 'Public ECDH keys - private keys NEVER in database';

-- Table 5: conversation_keys (Encrypted shared secrets)
CREATE TABLE IF NOT EXISTS conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_shared_secret TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user_version UNIQUE (conversation_id, user_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_conversation_keys_conversation ON conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_keys_user ON conversation_keys(user_id);

ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation keys" ON conversation_keys;
CREATE POLICY "Users can view own conversation keys" ON conversation_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create conversation keys" ON conversation_keys;
CREATE POLICY "Users can create conversation keys" ON conversation_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users cannot update keys" ON conversation_keys;
CREATE POLICY "Users cannot update keys" ON conversation_keys
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users cannot delete keys" ON conversation_keys;
CREATE POLICY "Users cannot delete keys" ON conversation_keys
  FOR DELETE USING (false);

COMMENT ON TABLE conversation_keys IS 'Immutable encrypted shared secrets';

-- Table 6: typing_indicators (Real-time typing status)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON typing_indicators(conversation_id, updated_at DESC);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view typing in own conversations" ON typing_indicators;
CREATE POLICY "Users can view typing in own conversations" ON typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = typing_indicators.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own typing status" ON typing_indicators;
CREATE POLICY "Users can insert own typing status" ON typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own typing status" ON typing_indicators;
CREATE POLICY "Users can update own typing status" ON typing_indicators
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can clean up old indicators" ON typing_indicators;
CREATE POLICY "System can clean up old indicators" ON typing_indicators
  FOR DELETE TO service_role USING (updated_at < now() - INTERVAL '5 seconds');

COMMENT ON TABLE typing_indicators IS 'Real-time typing with auto-expire after 5 seconds';

-- Messaging Triggers
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

CREATE OR REPLACE FUNCTION assign_sequence_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM messages WHERE conversation_id = NEW.conversation_id;
  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_message_insert ON messages;
CREATE TRIGGER before_message_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION assign_sequence_number();

COMMENT ON FUNCTION update_conversation_timestamp() IS 'Auto-update conversation.last_message_at';
COMMENT ON FUNCTION assign_sequence_number() IS 'Auto-increment message sequence numbers';

-- Grant permissions for messaging tables
GRANT ALL ON user_connections TO authenticated, service_role;
GRANT ALL ON conversations TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;
GRANT ALL ON user_encryption_keys TO authenticated, service_role;
GRANT ALL ON conversation_keys TO authenticated, service_role;
GRANT ALL ON typing_indicators TO authenticated, service_role;

-- ============================================================================
-- PART 10.5: GROUP CHAT SUPPORT (Feature 010)
-- ============================================================================
-- Symmetric key encryption for group messages
-- Features: Up to 200 members, key versioning, history restriction, key rotation
-- Tables modified: conversations, messages
-- Tables new: conversation_members, group_keys

-- T006: Add group columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT CHECK (length(group_name) <= 100),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS current_key_version INTEGER NOT NULL DEFAULT 1;

-- Make participant columns nullable for groups (they must be NULL for is_group=true)
ALTER TABLE conversations
  ALTER COLUMN participant_1_id DROP NOT NULL,
  ALTER COLUMN participant_2_id DROP NOT NULL;

-- CHK023: Enforce is_group validation via CHECK constraint
-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS check_group_participants;
ALTER TABLE conversations ADD CONSTRAINT check_group_participants CHECK (
  (is_group = false AND participant_1_id IS NOT NULL AND participant_2_id IS NOT NULL)
  OR
  (is_group = true AND participant_1_id IS NULL AND participant_2_id IS NULL AND created_by IS NOT NULL)
);

-- T007: Add key_version column to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;

-- #147: bind ciphertext to the keys that encrypted it.
--
-- key_version above is a constant 1 on every row, so a message carries no
-- record of WHICH key encrypted it. ECDH needs the sender's public key and the
-- recipient's private key, so either side rotating makes the ciphertext
-- undecryptable — and today that surfaces only as a caught AES-GCM exception,
-- never as a deterministic check. These two columns let the reader tell which
-- side rotated, and let a future repair path find the old key: revoked rows are
-- retained (revoked = true), not deleted.
--
-- Nullable and additive on purpose: existing rows and any code that does not yet
-- populate them keep working unchanged. ON DELETE SET NULL so removing a key row
-- degrades a message to "unknown key" rather than blocking the delete or
-- cascading into message loss.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_key_id UUID
    REFERENCES user_encryption_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_key_id UUID
    REFERENCES user_encryption_keys(id) ON DELETE SET NULL;

-- T008: Add system message columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_message_type TEXT;

-- CHK027: Validate system_message_type enum values
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_system_message_type;
ALTER TABLE messages ADD CONSTRAINT check_system_message_type CHECK (
  system_message_type IS NULL
  OR system_message_type IN (
    'member_joined',
    'member_left',
    'member_removed',
    'group_created',
    'group_renamed',
    'ownership_transferred'
  )
);

-- T009: Create conversation_members junction table
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  key_version_joined INTEGER NOT NULL DEFAULT 1,
  key_status TEXT NOT NULL DEFAULT 'active' CHECK (key_status IN ('active', 'pending')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE
);

-- CHK025: Unique active membership per user per conversation
-- This constraint allows same user_id + conversation_id only if one has left_at set
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_membership
  ON conversation_members(conversation_id, user_id) WHERE left_at IS NULL;

-- T010: Create group_keys table
CREATE TABLE IF NOT EXISTS group_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_version INTEGER NOT NULL DEFAULT 1,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  CONSTRAINT unique_group_key_version UNIQUE (conversation_id, user_id, key_version)
);

-- T011: Add indexes for conversation_members and group_keys tables
-- CHK026: Indexes for fast member list lookup
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON conversation_members(conversation_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id) WHERE left_at IS NULL;

-- Indexes for group_keys
CREATE INDEX IF NOT EXISTS idx_group_keys_conversation
  ON group_keys(conversation_id, key_version DESC);
CREATE INDEX IF NOT EXISTS idx_group_keys_user
  ON group_keys(user_id, conversation_id);

-- T012: Enable RLS on conversation_members and group_keys tables
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_keys ENABLE ROW LEVEL SECURITY;

-- T013: RLS policies for conversation_members

-- FIX: Create SECURITY DEFINER function to check membership without triggering RLS
-- This prevents infinite recursion when RLS policies query conversation_members
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND left_at IS NULL
  );
$$;

-- FIX: Check if user is owner of conversation (for permission checks)
CREATE OR REPLACE FUNCTION is_conversation_owner(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND role = 'owner'
      AND left_at IS NULL
  );
$$;

-- SECURITY (#34): check whether a user CREATED a conversation, reading
-- conversations.created_by directly. SECURITY DEFINER because the
-- conversations SELECT policy only exposes 1-to-1 participant rows, so a
-- group's creator cannot see their own group row through RLS — an inline
-- EXISTS sub-select against conversations returns nothing for a group and
-- would wrongly reject the creator. This helper is the creator-scoped
-- counterpart to is_conversation_member(), and unlike is_conversation_owner()
-- it does not depend on a membership row existing yet, so it also authorizes
-- the very first owner-row insert during group creation.
CREATE OR REPLACE FUNCTION is_conversation_creator(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
      AND created_by = check_user_id
  );
$$;

-- SELECT: Members can see other members of their conversations
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (
    is_conversation_member(conversation_id)
  );

-- INSERT: existing members can add others (connection validation in the
-- service layer), and the conversation's CREATOR can seat the initial roster.
--
-- SECURITY (#34): the self-join branch was `user_id = auth.uid()`, which let
-- ANY authenticated user insert a membership row for themselves into ANY
-- group — a privilege escalation, since conversation_members / group_keys /
-- messages all gate reads through is_conversation_member(). Scoping the
-- second branch to the conversation's creator closes that: only the creator
-- can seed a group (covers createGroup's owner + member batch insert), while
-- an outsider self-insert now fails both branches.
DROP POLICY IF EXISTS "Members can add to their conversations" ON conversation_members;
CREATE POLICY "Members can add to their conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
    OR is_conversation_creator(conversation_id)
  );

-- UPDATE: Members can update own preferences, owners can update others
DROP POLICY IF EXISTS "Members can update membership" ON conversation_members;
CREATE POLICY "Members can update membership" ON conversation_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_conversation_owner(conversation_id)
  );

-- DELETE: No direct deletes - use soft delete via left_at
DROP POLICY IF EXISTS "No direct member deletes" ON conversation_members;
CREATE POLICY "No direct member deletes" ON conversation_members
  FOR DELETE USING (false);

-- T014: RLS policies for group_keys

-- SELECT: Users can only see their own encrypted keys (and must be active member)
DROP POLICY IF EXISTS "Users can view their own keys" ON group_keys;
CREATE POLICY "Users can view their own keys" ON group_keys
  FOR SELECT USING (
    user_id = auth.uid()
    AND is_conversation_member(conversation_id)
  );

-- INSERT: Active members can distribute keys
DROP POLICY IF EXISTS "Members can distribute keys" ON group_keys;
CREATE POLICY "Members can distribute keys" ON group_keys
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
  );

-- UPDATE: No updates allowed - keys are immutable
DROP POLICY IF EXISTS "Keys are immutable" ON group_keys;
CREATE POLICY "Keys are immutable" ON group_keys
  FOR UPDATE USING (false);

-- DELETE: No direct deletes - orphaned keys are harmless
DROP POLICY IF EXISTS "No direct key deletes" ON group_keys;
CREATE POLICY "No direct key deletes" ON group_keys
  FOR DELETE USING (false);

-- T014a: Update messages table RLS for group membership

-- Drop and recreate SELECT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    -- 1-to-1 conversations: check participant columns
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.is_group = false
        AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
    )
    OR
    -- Group conversations: check membership via SECURITY DEFINER function
    is_conversation_member(conversation_id)
  );

-- Drop and recreate INSERT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- 1-to-1: existing logic
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
          AND c.is_group = false
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
      OR
      -- Group: check active membership via SECURITY DEFINER function
      is_conversation_member(conversation_id)
    )
  );

-- Grant permissions for new tables
GRANT ALL ON conversation_members TO authenticated, service_role;
GRANT ALL ON group_keys TO authenticated, service_role;

-- Enable realtime for group tables
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE group_keys REPLICA IDENTITY FULL;

COMMENT ON TABLE conversation_members IS 'Junction table linking users to group conversations with membership metadata';
COMMENT ON TABLE group_keys IS 'Encrypted symmetric group keys per member per version';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created:
--   ✅ Payment tables: payment_intents, payment_results, subscriptions, webhook_events, payment_provider_config
--   ✅ Auth tables: user_profiles, auth_audit_logs
--   ✅ Security tables: rate_limit_attempts, oauth_states
--   ✅ Messaging tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
--   ✅ Group chat tables: conversation_members, group_keys (Feature 010)
--   ✅ Storage buckets: avatars (5MB limit, public read)
--   ✅ Functions: update_updated_at_column, create_user_profile, cleanup_old_audit_logs, log_auth_audit_event, check_rate_limit, record_failed_attempt, update_conversation_timestamp, assign_sequence_number
--   ✅ Admin RPC functions: admin_payment_stats, admin_auth_stats, admin_user_stats, admin_messaging_stats, admin_payment_trends, admin_audit_trends, admin_list_users, admin_messaging_trends, admin_overview
--   ✅ Triggers: on_auth_user_created, update_user_profiles_updated_at, on_message_inserted, before_message_insert
--   ✅ RLS policies: All tables + storage.objects protected with auth.uid() (35 + 9 admin policies)
--   ✅ Admin RLS policies: 9 read-only policies for admin dashboard (is_admin check)
--   ✅ Avatar policies: 4 policies (user isolation + public read)
--   ✅ Messaging policies: 17 policies (E2E encryption, user isolation, 15-min edit window)
--   ✅ Group chat policies: 8 policies (membership access, key distribution)
--   ✅ Permissions: Authenticated users + service role (all tables)
--   ✅ Test user: test@example.com (primary, email confirmed)
--   ✅ Admin user: scripthammer (Feature 002 - welcome messages, is_admin = TRUE)
-- ============================================================================

-- Admin profile for system welcome messages (Feature 002)
-- Fixed UUID: 00000000-0000-0000-0000-000000000001
-- NOTE: Admin RLS policies use JWT claims from auth.users.raw_app_meta_data, NOT this column.
-- To grant admin access to a real user, run:
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE id = '<user-uuid>';
-- The is_admin column on user_profiles is for application-level queries only.
--
-- Local-profile caveat, same story as PART 8: user_profiles.id has an FK to
-- auth.users(id). On Cloud the admin auth.users row already exists, so this
-- INSERT is fine. On a fresh local initdb the admin row is created post-boot
-- by scripts/seed-test-users.ts -- which then fires the on_auth_user_created
-- trigger to make a bare user_profiles row, at which point re-running this
-- file (or just this one statement) hits the ON CONFLICT DO UPDATE branch and
-- fills in username / is_admin. Either way, crashing initdb over it means
-- postinit never runs and the whole stack stays on 28P01. Soft-skip instead.
DO $seed_admin_profile$
BEGIN
  INSERT INTO user_profiles (id, username, display_name, welcome_message_sent, is_admin)
  VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE
      'Skipping admin profile seed (no auth.users row ...001 yet: %). '
      'On the local profile this is expected -- scripts/seed-test-users.ts '
      'creates the admin user, then the on_auth_user_created trigger makes a '
      'bare profile row, then re-running this statement fills in is_admin.',
      SQLERRM;
END
$seed_admin_profile$;

-- ============================================================================
-- Feature 004 / Issue #29: Populate OAuth user profiles (one-time backfill)
-- Only updates NULL display_name for OAuth users.
-- Idempotent: Safe to run multiple times (FR-006).
--
-- Cascade mirrors src/lib/auth/oauth-utils.ts extractOAuthDisplayName():
--   full_name > name > user_name > preferred_username > 'User-<8 hex of id>'
-- The email address is NOT in the cascade — display_name is world-readable to
-- every authenticated account.
--
-- Provider notes:
--   - Google sets full_name AND name
--   - GitHub sets name (display name) AND user_name (the @handle) — without
--     user_name in the cascade, GitHub users with no GitHub display name
--     would fall through to the opaque handle even though the @handle is a
--     better identifier
--   - Other OIDC providers may set preferred_username
--
-- Note on runtime behavior: since #105 create_user_profile() (the
-- on_auth_user_created trigger) DOES set display_name, from OAuth provider
-- metadata else an opaque 'User-<8 hex>' handle. It never derives the value
-- from the email address. The runtime seeders in src/lib/auth/oauth-utils.ts
-- (ensureDisplayNameSeeded / populateOAuthProfile) use the same cascade and
-- only fill a blank value. This UPDATE handles only the one-time bootstrap
-- for users who existed before that runtime path landed.
-- ============================================================================
UPDATE public.user_profiles p
SET
  display_name = COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'preferred_username'), ''),
    'User-' || left(replace(p.id::text, '-', ''), 8)
  ),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email';

-- ============================================================================
-- Issue #105 follow-up: un-publish email-derived display names
-- ============================================================================
-- The #105 trigger + runtime seeder wrote split_part(email, '@', 1) into
-- user_profiles.display_name for email/password accounts. That column is readable
-- by every authenticated user, so those rows published part of each user's email
-- address. Reset the rows that were auto-seeded back to the opaque handle.
--
-- Match condition: display_name still equals the email local-part exactly AND the
-- account has no provider-metadata name that would have won the cascade — i.e. the
-- value can only have come from the email tier.
--
-- Idempotent: after the first run no row matches (display_name no longer equals the
-- local-part).
--
-- Accepted tradeoff: a user who deliberately typed their own email local-part as a
-- display name is reset too and must re-enter it in Account Settings. That value is
-- indistinguishable from the auto-seed and is already disclosed either way.
UPDATE public.user_profiles p
SET display_name = 'User-' || left(replace(p.id::text, '-', ''), 8),
    updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND u.email IS NOT NULL
  AND p.display_name = left(split_part(u.email, '@', 1), 100)
  AND COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'user_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'preferred_username'), '')
      ) IS NULL;

-- ============================================================================
-- PART 10: REALTIME CONFIGURATION
-- Enable realtime subscriptions for messaging tables
-- ============================================================================
--
-- Ported from SpokeToWork fork. Required for:
--   - useUnreadCount hook (subscribes to messages INSERT/UPDATE/DELETE)
--   - real-time conversation list updates
--   - typing indicator presence
--   - group membership changes
--   - friend request status changes
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the full row
-- payload (not just the primary key), so Realtime clients can inspect
-- what changed without a follow-up query.
--
-- ALTER PUBLICATION ADD TABLE is idempotent-guarded via pg_publication_tables
-- checks — running this migration twice won't double-add.

-- Create supabase_realtime publication if it doesn't exist.
-- Supabase Cloud normally provisions this, but the guard makes the
-- migration portable to self-hosted Postgres.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- REPLICA IDENTITY FULL is required for Realtime UPDATE/DELETE events
-- to include the full row payload.
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE user_connections REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication.
-- Each ADD is guarded by a pg_publication_tables check so this block
-- is safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;
  END IF;

  -- Payment surfaces: live-update the /payment hub (PaymentHistory +
  -- SubscriptionManager) via postgres_changes. Without publication membership
  -- the realtime channel subscribes but never receives INSERT/UPDATE events.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payment_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_results;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  END IF;

  -- typing_indicators was published but has no reader and no writer: nothing in
  -- src/ ever calls .from('typing_indicators'), and typing is broadcast-only.
  -- Publishing it billed Realtime deliveries for a table nobody subscribes to
  -- (#224). Guarded DROP so databases created before this change converge.
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.typing_indicators;
  END IF;
END $$;

-- ============================================================================
-- RESCUEDOGS: ANTI-GHOSTING MVP
-- Shelters, pets, adopter profiles, applications, status tracking
-- Constitution: Principle I (No One Gets Ghosted) — every status mutation
-- writes an auditable history row that powers the applicant-facing timeline.
-- Principle III (Applicant Data Is a Trust) — own-row RLS; staff see the
-- frozen application snapshot, never the adopter's live profile.
-- ============================================================================

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shelters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) >= 2 AND length(name) <= 120),
  city TEXT CHECK (length(city) <= 100),
  state TEXT CHECK (length(state) <= 50),
  zip TEXT CHECK (length(zip) <= 20),
  contact_email TEXT CHECK (length(contact_email) <= 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent for databases created before zip existed (#110)
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS zip TEXT;
DO $$
BEGIN
  ALTER TABLE shelters ADD CONSTRAINT shelters_zip_length
    CHECK (zip IS NULL OR length(zip) <= 20);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE shelters IS 'Rescue organizations; MVP seeds exactly one (Second Chance Rescue)';
COMMENT ON COLUMN shelters.zip IS 'Postal code for browse location filters; pets inherit via shelter_id (#110/#111)';

-- The browse state filter matches exact 2-letter codes, so a rescue that typed
-- "Texas" or "tx" at sign-up was invisible to it. Single source of truth for the
-- valid set, shared by the CHECK constraints and the shelter RPCs (#331).
CREATE OR REPLACE FUNCTION us_state_codes()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ARRAY[
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
    'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
    'VT','VA','WA','WV','WI','WY'
  ]::TEXT[];
$$;

COMMENT ON FUNCTION us_state_codes() IS
  'Valid US state/DC codes for shelters.state and shelters.transport_states (#331).';

-- Backfill legacy free-text states ("Texas", "tx ") to codes (#331).
UPDATE shelters AS s
SET state = m.code
FROM (
  VALUES
    ('alabama','AL'),('alaska','AK'),('arizona','AZ'),('arkansas','AR'),
    ('california','CA'),('colorado','CO'),('connecticut','CT'),
    ('delaware','DE'),('district of columbia','DC'),('washington dc','DC'),
    ('washington d.c.','DC'),('florida','FL'),('georgia','GA'),('hawaii','HI'),
    ('idaho','ID'),('illinois','IL'),('indiana','IN'),('iowa','IA'),
    ('kansas','KS'),('kentucky','KY'),('louisiana','LA'),('maine','ME'),
    ('maryland','MD'),('massachusetts','MA'),('michigan','MI'),
    ('minnesota','MN'),('mississippi','MS'),('missouri','MO'),('montana','MT'),
    ('nebraska','NE'),('nevada','NV'),('new hampshire','NH'),
    ('new jersey','NJ'),('new mexico','NM'),('new york','NY'),
    ('north carolina','NC'),('north dakota','ND'),('ohio','OH'),
    ('oklahoma','OK'),('oregon','OR'),('pennsylvania','PA'),
    ('rhode island','RI'),('south carolina','SC'),('south dakota','SD'),
    ('tennessee','TN'),('texas','TX'),('utah','UT'),('vermont','VT'),
    ('virginia','VA'),('washington','WA'),('west virginia','WV'),
    ('wisconsin','WI'),('wyoming','WY')
) AS m(full_name, code)
WHERE s.state IS NOT NULL
  AND lower(btrim(s.state)) = m.full_name
  AND s.state <> m.code;

UPDATE shelters
SET state = upper(btrim(state))
WHERE state IS NOT NULL
  AND btrim(state) <> ''
  AND upper(btrim(state)) = ANY (us_state_codes())
  AND state <> upper(btrim(state));

-- NOT VALID: anything still unmappable (a typo, a non-US region) keeps its row
-- readable while every future write goes through the check.
DO $$
BEGIN
  ALTER TABLE shelters ADD CONSTRAINT shelters_state_code
    CHECK (state IS NULL OR state = ANY (us_state_codes())) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Out-of-state transport (#331). transports is the rescue-wide switch;
-- transport_states is where they will ship. A pet is transportable when its
-- rescue transports AND pets.transportable is still true, so flipping the
-- rescue switch on later covers listings that already exist.
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS transports BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS transport_states TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS transport_note TEXT;

DO $$
BEGIN
  ALTER TABLE shelters ADD CONSTRAINT shelters_transport_states_codes
    CHECK (transport_states <@ us_state_codes());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE shelters ADD CONSTRAINT shelters_transport_note_length
    CHECK (transport_note IS NULL OR length(transport_note) <= 500);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_shelters_transport_states
  ON shelters USING GIN (transport_states);

COMMENT ON COLUMN shelters.state IS '2-letter US state/DC code; browse filters match it exactly (#331)';
COMMENT ON COLUMN shelters.transports IS 'Rescue-wide switch: this rescue transports animals out of state (#331)';
COMMENT ON COLUMN shelters.transport_states IS 'State codes this rescue will transport to; meaningless unless transports (#331)';
COMMENT ON COLUMN shelters.transport_note IS 'Optional public transport details shown to adopters — fees, cadence (#331)';

CREATE TABLE IF NOT EXISTS shelter_members (
  shelter_id UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shelter_id, user_id)
);

COMMENT ON TABLE shelter_members IS 'Shelter staff membership; powers is_shelter_staff() RLS checks. Distinct from user_profiles.is_admin (platform admin).';

CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 60),
  species TEXT NOT NULL DEFAULT 'dog' CHECK (species IN ('dog', 'cat')),
  breed TEXT CHECK (length(breed) <= 100),
  sex TEXT CHECK (
    sex IS NULL OR sex IN (
      'male',
      'female',
      'neutered_male',
      'neutered_female'
    )
  ),
  age_years NUMERIC(5,2) CHECK (age_years >= 0 AND age_years <= 40),
  size TEXT CHECK (size IN ('small', 'medium', 'large')),
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'pending', 'adopted')),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  video_url TEXT CHECK (
    video_url IS NULL OR (
      length(video_url) <= 2048
      AND video_url ~* '^https://'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Widen age precision for years+months intake (#272); idempotent on existing DBs.
ALTER TABLE pets
  ALTER COLUMN age_years TYPE NUMERIC(5,2)
  USING age_years::numeric(5,2);

-- Idempotent for databases created before notes (#167)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS notes TEXT;
DO $$
BEGIN
  ALTER TABLE pets ADD CONSTRAINT pets_notes_length
    CHECK (notes IS NULL OR length(notes) <= 2000);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional public video link (YouTube / TikTok / etc.) — link-out only (#326)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS video_url TEXT;
DO $$
BEGIN
  ALTER TABLE pets ADD CONSTRAINT pets_video_url_https
    CHECK (
      video_url IS NULL OR (
        length(video_url) <= 2048
        AND video_url ~* '^https://'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Per-pet transport opt-OUT (#331). Defaults true so enabling the rescue-wide
-- switch covers existing listings; staff untick the odd pet that cannot travel.
-- Never a copy of shelters.transports — it is only read alongside it.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS transportable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pets_shelter_available
  ON pets(shelter_id) WHERE status = 'available';

COMMENT ON TABLE pets IS 'Pet records for apply / browse / shelter staff. notes = public short bio (#167). video_url = optional public video link (#326).';
COMMENT ON COLUMN pets.notes IS 'Public short bio for browse cards; staff-editable; omit UI when null/empty (#167)';
COMMENT ON COLUMN pets.video_url IS 'Optional https URL to a public video (YouTube, TikTok, Vimeo, etc.); open in new tab — no upload/embed (#326)';
COMMENT ON COLUMN pets.transportable IS 'Per-pet opt-out of the rescue transport offer; only meaningful when shelters.transports (#331)';

-- Pet-specific application question groups (#337). Empty = no tagged groups.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS application_tags TEXT[] NOT NULL DEFAULT '{}';
DO $$
BEGIN
  ALTER TABLE pets ADD CONSTRAINT pets_application_tags_valid
    CHECK (
      application_tags <@ ARRAY[
        'sighthound',
        'bully_breed',
        'large_dog',
        'escape_risk',
        'senior',
        'special_needs'
      ]::text[]
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON COLUMN pets.application_tags IS 'Which pet-specific question groups this listing adds to its application (#337).';

-- Pet sex options expanded for shelter intake (#273)
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_sex_check;
ALTER TABLE pets ADD CONSTRAINT pets_sex_check CHECK (
  sex IS NULL OR sex IN (
    'male',
    'female',
    'neutered_male',
    'neutered_female'
  )
);

CREATE TABLE IF NOT EXISTS pet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
    CHECK (sort_order >= 0 AND sort_order < 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pet_photos_pet_id_sort_order_key
    UNIQUE (pet_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE
);

-- Deferrable so reorder_pet_photos can swap slots inside one transaction; the
-- CHECK above rules out parking rows at temporary out-of-range positions (#338).
-- Postgres cannot ALTER a UNIQUE constraint's deferrability, so re-create it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pet_photos'::regclass
      AND conname = 'pet_photos_pet_id_sort_order_key'
      AND NOT condeferrable
  ) THEN
    ALTER TABLE pet_photos DROP CONSTRAINT pet_photos_pet_id_sort_order_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pet_photos'::regclass
      AND conname = 'pet_photos_pet_id_sort_order_key'
  ) THEN
    ALTER TABLE pet_photos
      ADD CONSTRAINT pet_photos_pet_id_sort_order_key
      UNIQUE (pet_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON pet_photos(pet_id);

COMMENT ON TABLE pet_photos IS 'Up to 4 gallery images per pet; sort_order 0 = primary browse photo (#273)';

-- Backfill gallery from legacy photo_url (idempotent)
INSERT INTO pet_photos (pet_id, url, sort_order)
SELECT id, photo_url, 0
FROM pets
WHERE photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pet_photos pp WHERE pp.pet_id = pets.id AND pp.sort_order = 0
  );

CREATE TABLE IF NOT EXISTS adopter_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) >= 2 AND length(full_name) <= 100),
  phone TEXT CHECK (length(phone) <= 30),
  address_line TEXT CHECK (length(address_line) <= 200),
  city TEXT CHECK (length(city) <= 100),
  state TEXT CHECK (length(state) <= 50),
  zip TEXT CHECK (length(zip) <= 20),
  housing_type TEXT NOT NULL CHECK (housing_type IN
    ('own_house', 'own_condo', 'rent_house', 'rent_apartment', 'other')),
  landlord_approval BOOLEAN,
  landlord_contact TEXT CHECK (length(landlord_contact) <= 200),
  has_yard BOOLEAN NOT NULL DEFAULT FALSE,
  yard_fenced BOOLEAN,
  household_adults SMALLINT NOT NULL DEFAULT 1 CHECK (household_adults >= 1 AND household_adults <= 20),
  household_children SMALLINT NOT NULL DEFAULT 0 CHECK (household_children >= 0 AND household_children <= 20),
  other_pets TEXT CHECK (length(other_pets) <= 1000),
  vet_name TEXT CHECK (length(vet_name) <= 120),
  vet_phone TEXT CHECK (length(vet_phone) <= 30),
  experience TEXT CHECK (length(experience) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE adopter_profiles IS 'The reusable universal application: fill once, prefill every future application. landlord_approval required-when-renting is enforced by Zod at submit, not the DB.';

DROP TRIGGER IF EXISTS update_adopter_profiles_updated_at ON adopter_profiles;
CREATE TRIGGER update_adopter_profiles_updated_at
  BEFORE UPDATE ON adopter_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adopter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  shelter_id UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN
    ('submitted', 'under_review', 'reference_check', 'home_visit',
     'approved', 'not_selected', 'withdrawn')),
  profile_snapshot JSONB NOT NULL CHECK (jsonb_typeof(profile_snapshot) = 'object'),
  why_this_pet TEXT CHECK (length(why_this_pet) <= 2000),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_application_per_pet UNIQUE (adopter_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_adopter
  ON applications(adopter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_shelter_status
  ON applications(shelter_id, status, status_changed_at DESC);

-- One home per pet: at most one approved application per pet_id (#34).
-- Complements the EXISTS guard in advance_application_status (race-safe).
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_one_approved_per_pet
  ON applications (pet_id)
  WHERE status = 'approved';

COMMENT ON TABLE applications IS 'profile_snapshot freezes the adopter profile at submit time — staff review what was actually submitted; later profile edits never mutate in-flight applications.';

CREATE TABLE IF NOT EXISTS application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT CHECK (length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_app
  ON application_status_history(application_id, created_at);

COMMENT ON TABLE application_status_history IS 'Adopter-visible audit trail powering the status tracker timeline. note is shown to the adopter (e.g. "Home visit scheduled for Saturday"). Rows written only by SECURITY DEFINER functions.';

-- ─── Helper: staff membership check (avoids recursive RLS policies) ────────

CREATE OR REPLACE FUNCTION is_shelter_staff(p_shelter UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE shelter_id = p_shelter
      AND user_id = check_user_id
  );
$$;

COMMENT ON FUNCTION is_shelter_staff(UUID, UUID) IS
  'True when check_user_id (default auth.uid()) is a member of p_shelter. SECURITY DEFINER to avoid recursive RLS.';

-- ─── Staff-only applicant email (#66) ──────────────────────────────────────
-- Returns auth.users.email for the application's adopter when the caller is
-- staff of that shelter. Never exposed via public profiles or messaging search.

CREATE OR REPLACE FUNCTION get_application_applicant_email(p_application_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shelter_id UUID;
  v_adopter_id UUID;
  v_email TEXT;
BEGIN
  SELECT shelter_id, adopter_id
  INTO v_shelter_id, v_adopter_id
  FROM applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;

  IF NOT is_shelter_staff(v_shelter_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_adopter_id;
  RETURN v_email;
END;
$$;

COMMENT ON FUNCTION get_application_applicant_email(UUID) IS
  'Staff-only: applicant auth email for a shelter application. Not for public search (#66).';

REVOKE ALL ON FUNCTION get_application_applicant_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_application_applicant_email(UUID) TO authenticated;

-- ─── Self-serve create-org (#218) ──────────────────────────────────────────
-- No client INSERT policies on shelters / shelter_members. First-time users
-- become manager of exactly one rescue. Existing members (incl. demo staff)
-- cannot create a second org.

-- Shared shelter-field validation for create/update (#331). Raises the same
-- invalid_* messages both RPCs already surface to the client.
CREATE OR REPLACE FUNCTION normalize_shelter_state(p_state TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_state TEXT := nullif(upper(btrim(COALESCE(p_state, ''))), '');
BEGIN
  IF v_state IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (v_state = ANY (us_state_codes())) THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  RETURN v_state;
END;
$$;

COMMENT ON FUNCTION normalize_shelter_state(TEXT) IS
  'Uppercase + validate a shelter state against us_state_codes(); raises invalid_state (#331).';

CREATE OR REPLACE FUNCTION normalize_transport_states(p_states TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_states TEXT[];
BEGIN
  IF p_states IS NULL THEN
    RETURN '{}'::TEXT[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT code ORDER BY code), '{}'::TEXT[])
  INTO v_states
  FROM (
    SELECT upper(btrim(unnested)) AS code
    FROM unnest(p_states) AS unnested
    WHERE nullif(btrim(unnested), '') IS NOT NULL
  ) AS cleaned;

  IF NOT (v_states <@ us_state_codes()) THEN
    RAISE EXCEPTION 'invalid_transport_states';
  END IF;

  RETURN v_states;
END;
$$;

COMMENT ON FUNCTION normalize_transport_states(TEXT[]) IS
  'Uppercase, de-duplicate and validate transport state codes; raises invalid_transport_states (#331).';

-- #331 widened the signature. Drop the 5-arg form so PostgREST cannot resolve
-- an ambiguous overload when the client posts the original argument names.
DROP FUNCTION IF EXISTS create_my_shelter(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_my_shelter(
  p_name TEXT,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_transports BOOLEAN DEFAULT FALSE,
  p_transport_states TEXT[] DEFAULT '{}',
  p_transport_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_city TEXT := nullif(btrim(COALESCE(p_city, '')), '');
  v_state TEXT := normalize_shelter_state(p_state);
  v_zip TEXT := nullif(btrim(COALESCE(p_zip, '')), '');
  v_email TEXT := nullif(btrim(COALESCE(p_contact_email, '')), '');
  v_transport_states TEXT[] := normalize_transport_states(p_transport_states);
  v_transports BOOLEAN := COALESCE(p_transports, FALSE);
  v_transport_note TEXT := nullif(btrim(COALESCE(p_transport_note, '')), '');
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM shelter_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  IF v_city IS NOT NULL AND length(v_city) > 100 THEN
    RAISE EXCEPTION 'invalid_city';
  END IF;
  IF v_zip IS NOT NULL AND length(v_zip) > 20 THEN
    RAISE EXCEPTION 'invalid_zip';
  END IF;
  IF v_transport_note IS NOT NULL AND length(v_transport_note) > 500 THEN
    RAISE EXCEPTION 'invalid_transport_note';
  END IF;

  -- An empty state list would advertise transport nowhere.
  IF v_transports AND array_length(v_transport_states, 1) IS NULL THEN
    RAISE EXCEPTION 'transport_states_required';
  END IF;
  IF NOT v_transports THEN
    v_transport_states := '{}'::TEXT[];
  END IF;

  -- contact_email is adopter-facing; never default it to the founder's
  -- private sign-in address. NULL unless explicitly entered (#197).
  IF v_email IS NOT NULL AND length(v_email) > 255 THEN
    RAISE EXCEPTION 'invalid_contact_email';
  END IF;

  INSERT INTO shelters (
    name, city, state, zip, contact_email,
    transports, transport_states, transport_note
  )
  VALUES (
    v_name, v_city, v_state, v_zip, v_email,
    v_transports, v_transport_states, v_transport_note
  )
  RETURNING id INTO v_id;

  INSERT INTO shelter_members (shelter_id, user_id, role)
  VALUES (v_id, v_uid, 'manager');

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION create_my_shelter(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) IS
  'Authenticated non-member creates one shelter and becomes manager (#218); carries transport settings (#331).';

REVOKE ALL ON FUNCTION create_my_shelter(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_my_shelter(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) TO authenticated;

-- ─── Manager edits their rescue (#331) ─────────────────────────────────────
-- shelters has SELECT-only RLS, so this SECURITY DEFINER RPC is the single
-- write path. Rescues created before transport existed need it to opt in.

CREATE OR REPLACE FUNCTION update_my_shelter(
  p_shelter_id UUID,
  p_name TEXT,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_transports BOOLEAN DEFAULT FALSE,
  p_transport_states TEXT[] DEFAULT '{}',
  p_transport_note TEXT DEFAULT NULL
)
RETURNS shelters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_city TEXT := nullif(btrim(COALESCE(p_city, '')), '');
  v_state TEXT := normalize_shelter_state(p_state);
  v_zip TEXT := nullif(btrim(COALESCE(p_zip, '')), '');
  v_email TEXT := nullif(btrim(COALESCE(p_contact_email, '')), '');
  v_transports BOOLEAN := COALESCE(p_transports, FALSE);
  v_transport_states TEXT[] := normalize_transport_states(p_transport_states);
  v_transport_note TEXT := nullif(btrim(COALESCE(p_transport_note, '')), '');
  v_row shelters;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_shelter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_shelter';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE user_id = v_uid
      AND shelter_id = p_shelter_id
      AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF v_city IS NOT NULL AND length(v_city) > 100 THEN
    RAISE EXCEPTION 'invalid_city';
  END IF;
  IF v_zip IS NOT NULL AND length(v_zip) > 20 THEN
    RAISE EXCEPTION 'invalid_zip';
  END IF;
  IF v_email IS NOT NULL AND length(v_email) > 255 THEN
    RAISE EXCEPTION 'invalid_contact_email';
  END IF;
  IF v_transport_note IS NOT NULL AND length(v_transport_note) > 500 THEN
    RAISE EXCEPTION 'invalid_transport_note';
  END IF;

  IF v_transports AND array_length(v_transport_states, 1) IS NULL THEN
    RAISE EXCEPTION 'transport_states_required';
  END IF;
  IF NOT v_transports THEN
    v_transport_states := '{}'::TEXT[];
  END IF;

  UPDATE shelters
  SET name = v_name,
      city = v_city,
      state = v_state,
      zip = v_zip,
      contact_email = v_email,
      transports = v_transports,
      transport_states = v_transport_states,
      transport_note = v_transport_note
  WHERE id = p_shelter_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION update_my_shelter(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) IS
  'Manager-only edit of their rescue profile + transport settings; shelters has no client UPDATE policy (#331).';

REVOKE ALL ON FUNCTION update_my_shelter(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_my_shelter(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT) TO authenticated;

-- Reorder a pet's gallery in one transaction (#338). Updating slots one row at
-- a time collided with UNIQUE (pet_id, sort_order) on the very first move.
-- SECURITY INVOKER so the pet_photos RLS policy still applies to every write.
CREATE OR REPLACE FUNCTION reorder_pet_photos(
  p_pet_id UUID,
  p_photo_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INT := COALESCE(array_length(p_photo_ids, 1), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pets
    WHERE id = p_pet_id AND is_shelter_staff(shelter_id)
  ) THEN
    RAISE EXCEPTION 'not_shelter_staff';
  END IF;

  -- The list must name every photo of this pet exactly once, so a stale page
  -- can never leave two rows fighting over a slot.
  IF v_count = 0
    OR v_count > 4
    OR (SELECT count(DISTINCT x) FROM unnest(p_photo_ids) AS x) <> v_count
    OR (SELECT count(*) FROM pet_photos WHERE pet_id = p_pet_id) <> v_count
    OR (
      SELECT count(*) FROM pet_photos
      WHERE pet_id = p_pet_id AND id = ANY (p_photo_ids)
    ) <> v_count
  THEN
    RAISE EXCEPTION 'invalid_photo_order';
  END IF;

  SET CONSTRAINTS pet_photos_pet_id_sort_order_key DEFERRED;

  UPDATE pet_photos AS pp
  SET sort_order = (o.ord - 1)::SMALLINT
  FROM unnest(p_photo_ids) WITH ORDINALITY AS o(photo_id, ord)
  WHERE pp.id = o.photo_id
    AND pp.pet_id = p_pet_id;

  UPDATE pets
  SET photo_url = (
    SELECT url FROM pet_photos
    WHERE pet_id = p_pet_id AND sort_order = 0
  )
  WHERE id = p_pet_id;
END;
$$;

COMMENT ON FUNCTION reorder_pet_photos(UUID, UUID[]) IS
  'Staff-only atomic gallery reorder; array index = sort_order, slot 0 syncs pets.photo_url (#338).';

REVOKE ALL ON FUNCTION reorder_pet_photos(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_pet_photos(UUID, UUID[]) TO authenticated;

-- ─── Manager adds staff by email (#220 / #261) ─────────────────────────────
-- shelter_members has no client INSERT policy, so this is the only self-serve
-- path to a second volunteer. auth.users is read inside the definer body and
-- never exposed to the client. The invitee must already have a confirmed
-- account: staff can read applicant names, addresses, and phone numbers, so an
-- unverified address must not be granted that access. #261 allows the same
-- Auth user on multiple rescues (invite-only); create_my_shelter still blocks
-- a second *self-serve created* org.

DROP FUNCTION IF EXISTS add_shelter_staff_by_email(TEXT);

CREATE OR REPLACE FUNCTION add_shelter_staff_by_email(
  p_email TEXT,
  p_shelter_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(nullif(btrim(COALESCE(p_email, '')), ''));
  v_shelter_id UUID := p_shelter_id;
  v_target_id UUID;
  v_confirmed_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_shelter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_shelter';
  END IF;

  IF v_email IS NULL OR length(v_email) > 255 OR v_email NOT LIKE '%_@_%' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Caller must be manager of the *active* rescue (not an arbitrary LIMIT 1).
  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE user_id = v_uid
      AND shelter_id = v_shelter_id
      AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  SELECT id, email_confirmed_at
  INTO v_target_id, v_confirmed_at
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'user_not_confirmed';
  END IF;

  -- Re-adding an existing teammate succeeds without a duplicate-key error.
  IF EXISTS (
    SELECT 1 FROM shelter_members
    WHERE shelter_id = v_shelter_id AND user_id = v_target_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO shelter_members (shelter_id, user_id, role)
  VALUES (v_shelter_id, v_target_id, 'staff');
END;
$$;

COMMENT ON FUNCTION add_shelter_staff_by_email(TEXT, UUID) IS
  'Manager adds an existing confirmed Auth user as staff of the given shelter (#220/#261).';

REVOKE ALL ON FUNCTION add_shelter_staff_by_email(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_shelter_staff_by_email(TEXT, UUID) TO authenticated;

-- ─── Manager views and removes teammates ─────────────────────────────────
-- shelter_members only lets a user see their own rows, so the roster and the
-- removal both go through definer RPCs that check the caller is a manager of
-- p_shelter_id. Managers remove staff only: removing a manager or yourself is
-- refused, so a rescue can never be left without a manager. Self-leave is
-- #389's leave_shelter.

CREATE OR REPLACE FUNCTION list_shelter_team(p_shelter_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shelter_members m
    WHERE m.shelter_id = p_shelter_id
      AND m.user_id = auth.uid()
      AND m.role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  RETURN QUERY
  SELECT m.user_id,
         u.email::TEXT,
         p.display_name::TEXT,
         m.role,
         m.created_at
  FROM shelter_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN user_profiles p ON p.id = m.user_id
  WHERE m.shelter_id = p_shelter_id
  ORDER BY (m.role = 'manager') DESC, m.created_at;
END;
$$;

REVOKE ALL ON FUNCTION list_shelter_team(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_shelter_team(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION remove_shelter_staff(
  p_shelter_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE shelter_id = p_shelter_id AND user_id = v_uid AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  SELECT shelter_members.role INTO v_target_role
  FROM shelter_members
  WHERE shelter_id = p_shelter_id AND user_id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  IF v_target_role = 'manager' THEN
    RAISE EXCEPTION 'cannot_remove_manager';
  END IF;

  DELETE FROM shelter_members
  WHERE shelter_id = p_shelter_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION remove_shelter_staff(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_shelter_staff(UUID, UUID) TO authenticated;

-- ─── Status transitions: SECURITY DEFINER RPCs (the only write path) ───────
-- applications has NO client UPDATE/DELETE policies; with output:'export'
-- there is no server runtime, so Postgres is the only trusted layer.

CREATE OR REPLACE FUNCTION advance_application_status(
  p_application_id UUID,
  p_to_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app applications;
  v_from_status TEXT;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;

  -- Guard first: only staff of the application's shelter may advance
  IF NOT is_shelter_staff(v_app.shelter_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_from_status := v_app.status;

  IF NOT (CASE v_from_status
    WHEN 'submitted'       THEN p_to_status IN ('under_review', 'not_selected')
    WHEN 'under_review'    THEN p_to_status IN ('reference_check', 'home_visit', 'approved', 'not_selected')
    WHEN 'reference_check' THEN p_to_status IN ('home_visit', 'approved', 'not_selected')
    WHEN 'home_visit'      THEN p_to_status IN ('approved', 'not_selected')
    -- Staff may leave approved (#35): reopen review or mark fall-through.
    -- not_selected / withdrawn stay terminal for applications.
    WHEN 'approved'        THEN p_to_status IN ('under_review', 'not_selected')
    ELSE FALSE
  END) THEN
    RAISE EXCEPTION 'illegal transition % -> %', v_from_status, p_to_status;
  END IF;

  -- One approved application per pet (#34). Lock the pet row so two
  -- concurrent approvals cannot both pass the EXISTS check; the unique
  -- partial index idx_applications_one_approved_per_pet is the backstop.
  IF p_to_status = 'approved' THEN
    PERFORM 1 FROM pets WHERE id = v_app.pet_id FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM applications
      WHERE pet_id = v_app.pet_id
        AND status = 'approved'
        AND id IS DISTINCT FROM p_application_id
    ) THEN
      RAISE EXCEPTION 'pet already has an approved application';
    END IF;
  END IF;

  UPDATE applications
  SET status = p_to_status, status_changed_at = NOW()
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  INSERT INTO application_status_history
    (application_id, from_status, to_status, changed_by, note)
  VALUES
    (p_application_id, v_from_status, p_to_status, auth.uid(), p_note);

  -- Pet lifecycle (#35): approval → pending; fall-through → available;
  -- reopen after approval → pending (still spoken for by this applicant).
  IF p_to_status = 'approved' THEN
    UPDATE pets SET status = 'pending' WHERE id = v_app.pet_id;
  ELSIF v_from_status = 'approved' AND p_to_status = 'not_selected' THEN
    UPDATE pets SET status = 'available' WHERE id = v_app.pet_id;
  ELSIF v_from_status = 'approved' AND p_to_status = 'under_review' THEN
    UPDATE pets SET status = 'pending' WHERE id = v_app.pet_id;
  END IF;

  RETURN v_app;
END;
$$;

COMMENT ON FUNCTION advance_application_status(UUID, TEXT, TEXT) IS
  'Staff-only status transitions. Enforces one approved app per pet (#34). '
  'Leaving approved to not_selected frees the pet; reopen to under_review keeps it pending (#35).';

-- Finalize: approved application → pet adopted (#35)
CREATE OR REPLACE FUNCTION finalize_adoption(p_application_id UUID)
RETURNS pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app applications;
  v_pet pets;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;

  IF NOT is_shelter_staff(v_app.shelter_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_app.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'only approved applications can be finalized';
  END IF;

  PERFORM 1 FROM pets WHERE id = v_app.pet_id FOR UPDATE;

  UPDATE pets
  SET status = 'adopted'
  WHERE id = v_app.pet_id
  RETURNING * INTO v_pet;

  RETURN v_pet;
END;
$$;

COMMENT ON FUNCTION finalize_adoption(UUID) IS
  'Staff-only: mark the pet adopted after an approved application (#35). '
  'Fall-through still uses advance_application_status(approved → not_selected).';

REVOKE ALL ON FUNCTION finalize_adoption(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_adoption(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION withdraw_application(p_application_id UUID)
RETURNS applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app applications;
  v_from_status TEXT;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;

  -- Guard first: only the adopter may withdraw their own application
  IF v_app.adopter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_from_status := v_app.status;

  IF v_from_status IN ('approved', 'not_selected', 'withdrawn') THEN
    RAISE EXCEPTION 'cannot withdraw a % application', v_from_status;
  END IF;

  UPDATE applications
  SET status = 'withdrawn', status_changed_at = NOW()
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  INSERT INTO application_status_history
    (application_id, from_status, to_status, changed_by)
  VALUES
    (p_application_id, v_from_status, 'withdrawn', auth.uid());

  RETURN v_app;
END;
$$;

-- Initial history row is never forgotten (Constitution Principle I)
CREATE OR REPLACE FUNCTION log_application_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO application_status_history
    (application_id, from_status, to_status, changed_by)
  VALUES
    (NEW.id, NULL, 'submitted', NEW.adopter_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_application_created ON applications;
CREATE TRIGGER on_application_created
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION log_application_submitted();

-- ─── Adopted pet closes its open applications (#339) ─────────────────────────
-- Principle I: an application must never sit open on a pet that is gone.
-- Approved applications are left alone (usually the adopting family);
-- not_selected / withdrawn are already terminal.

CREATE OR REPLACE FUNCTION close_open_applications_on_adoption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'adopted' AND OLD.status IS DISTINCT FROM 'adopted' THEN
    WITH closed AS (
      SELECT id, status AS from_status
      FROM applications
      WHERE pet_id = NEW.id
        AND status IN ('submitted', 'under_review', 'reference_check', 'home_visit')
      FOR UPDATE
    ), updated AS (
      UPDATE applications AS a
      SET status = 'not_selected', status_changed_at = NOW()
      FROM closed
      WHERE a.id = closed.id
      RETURNING a.id, closed.from_status
    )
    INSERT INTO application_status_history
      (application_id, from_status, to_status, changed_by, note)
    SELECT id, from_status, 'not_selected', auth.uid(), NEW.name || ' has been adopted.'
    FROM updated;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION close_open_applications_on_adoption() IS
  'AFTER UPDATE OF status on pets: moving a pet to adopted closes its open '
  'applications as not_selected with an adopter-visible note (#339).';

DROP TRIGGER IF EXISTS on_pet_adopted_close_applications ON pets;
CREATE TRIGGER on_pet_adopted_close_applications
  AFTER UPDATE OF status ON pets
  FOR EACH ROW
  EXECUTE FUNCTION close_open_applications_on_adoption();

-- ─── Approved application locks the pet's status (#354) ─────────────────────
-- While a pet has an approved application its status belongs to the
-- lifecycle RPCs. A direct UPDATE (e.g. the edit form re-sending a stale
-- value) must not relist it or undo an adoption. The RPCs are unaffected:
-- advance_application_status updates the application BEFORE the pet, so no
-- approved row remains when it frees the pet; finalize_adoption only moves
-- the pet to 'adopted'.
CREATE OR REPLACE FUNCTION guard_pet_status_against_approved_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status IN ('pending', 'adopted')
     AND NEW.status IS DISTINCT FROM 'adopted'
     AND EXISTS (
       SELECT 1 FROM applications
       WHERE pet_id = NEW.id AND status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'pet_status_locked_by_approved_application'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION guard_pet_status_against_approved_application() IS
  'BEFORE UPDATE OF status on pets: no relisting/un-adopting while an approved application exists (#354).';

DROP TRIGGER IF EXISTS guard_pet_status_approved_application ON pets;
CREATE TRIGGER guard_pet_status_approved_application
  BEFORE UPDATE OF status ON pets
  FOR EACH ROW
  EXECUTE FUNCTION guard_pet_status_against_approved_application();

-- One-time backfill for applications left open on already-adopted pets;
-- a no-op on re-run because closed applications no longer match.
WITH closed AS (
  SELECT a.id, a.status AS from_status, p.name AS pet_name
  FROM applications AS a
  JOIN pets AS p ON p.id = a.pet_id
  WHERE p.status = 'adopted'
    AND a.status IN ('submitted', 'under_review', 'reference_check', 'home_visit')
  FOR UPDATE OF a
), updated AS (
  UPDATE applications AS a
  SET status = 'not_selected', status_changed_at = NOW()
  FROM closed
  WHERE a.id = closed.id
  RETURNING a.id, closed.from_status, closed.pet_name
)
INSERT INTO application_status_history
  (application_id, from_status, to_status, changed_by, note)
SELECT id, from_status, 'not_selected', NULL, pet_name || ' has been adopted.'
FROM updated;

-- ─── Shelter email on new application (#260) ─────────────────────────────────
-- Ops: populate private.shelter_application_notify_config (edge URL + webhook
-- secret matching APPLICATION_NOTIFY_WEBHOOK_SECRET on the Edge Function).
-- Trigger no-ops when the row is missing or edge_function_url IS NULL.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.shelter_application_notify_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  edge_function_url TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON private.shelter_application_notify_config FROM PUBLIC;
GRANT SELECT ON private.shelter_application_notify_config TO postgres;

INSERT INTO private.shelter_application_notify_config (id, edge_function_url, webhook_secret)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION queue_shelter_application_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT edge_function_url, webhook_secret
  INTO v_url, v_secret
  FROM private.shelter_application_notify_config
  WHERE id = 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    body := jsonb_build_object(
      'application_id', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block application intake on notify failures.
    RAISE WARNING 'queue_shelter_application_notify failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION queue_shelter_application_notify() IS
  'AFTER INSERT on applications: async Edge Function invoke via pg_net (#260).';

DROP TRIGGER IF EXISTS on_application_created_notify ON applications;
CREATE TRIGGER on_application_created_notify
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION queue_shelter_application_notify();

-- ─── Rescue welcome email after email verify (#316) ───────────────────────────
-- Ops: set private.rescue_welcome_email_config.edge_function_url to
--   https://<ref>.supabase.co/functions/v1/send-rescue-welcome-email
-- and webhook_secret to match RESCUE_WELCOME_WEBHOOK_SECRET on the function
-- (may reuse APPLICATION_NOTIFY_WEBHOOK_SECRET). No-op until configured.

CREATE TABLE IF NOT EXISTS private.rescue_welcome_email_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  edge_function_url TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON private.rescue_welcome_email_config FROM PUBLIC;
GRANT SELECT ON private.rescue_welcome_email_config TO postgres;

INSERT INTO private.rescue_welcome_email_config (id, edge_function_url, webhook_secret)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION queue_rescue_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_email TEXT;
BEGIN
  -- Fire only when email flips from unconfirmed → confirmed.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.email_confirmed_at IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Skip E2E / fixture users so CI createUser(email_confirm := true) does not
  -- invoke Resend (shared Cloud project + free-tier quota).
  IF COALESCE((NEW.raw_app_meta_data->>'e2e')::boolean, false)
     OR COALESCE((NEW.raw_user_meta_data->>'e2e')::boolean, false) THEN
    RETURN NEW;
  END IF;

  v_email := lower(coalesce(NEW.email, ''));
  IF v_email LIKE '%@example.com'
     OR v_email LIKE '%.demo'
     OR v_email LIKE '%+e2e%'
     OR v_email LIKE '%+playwright%'
     OR v_email LIKE '%+ci-%' THEN
    RETURN NEW;
  END IF;

  SELECT edge_function_url, webhook_secret
  INTO v_url, v_secret
  FROM private.rescue_welcome_email_config
  WHERE id = 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'queue_rescue_welcome_email failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION queue_rescue_welcome_email() IS
  'On email confirm: async send-rescue-welcome-email via pg_net (#316). Skips e2e/test recipients.';

-- Local-profile caveat (same cause as the test-user seed above): on a fresh
-- local initdb GoTrue has not yet run its migrations, so auth.users still has
-- the base image's 2016-era columns and no email_confirmed_at. `UPDATE OF
-- email_confirmed_at` then fails with 42703 and, under ON_ERROR_STOP, aborts
-- the rest of this file -- the local stack could not boot at all. We must not
-- forward-fill the column (GoTrue's own ADD COLUMN would then crash), so where
-- it is absent we fall back to an unqualified AFTER UPDATE. The function's
-- first lines return immediately unless the email flipped to confirmed, so the
-- two forms behave identically; on Supabase Cloud the column exists and the
-- trigger is created exactly as before.
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_welcome ON auth.users;
DO $welcome_trigger$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
      AND column_name = 'email_confirmed_at'
  ) THEN
    CREATE TRIGGER on_auth_user_email_confirmed_welcome
      AFTER UPDATE OF email_confirmed_at ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION queue_rescue_welcome_email();
  ELSE
    CREATE TRIGGER on_auth_user_email_confirmed_welcome
      AFTER UPDATE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION queue_rescue_welcome_email();
  END IF;
END
$welcome_trigger$;

DROP TRIGGER IF EXISTS on_auth_user_created_welcome_if_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_created_welcome_if_confirmed
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION queue_rescue_welcome_email();

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE adopter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;

-- shelters: reference data — authenticated full read; public for browse location (#112)
DROP POLICY IF EXISTS "Authenticated users can view shelters" ON shelters;
CREATE POLICY "Authenticated users can view shelters" ON shelters
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can view shelters" ON shelters;
CREATE POLICY "Public can view shelters" ON shelters
  FOR SELECT TO anon USING (true);

-- RLS filters rows, not columns: without column grants, anon could request
-- ?select=contact_email (#197). Signed-out browse reads only these columns;
-- authenticated users keep full read. REVOKE must precede the column GRANT,
-- because revoking a table privilege also drops column-level ones.
REVOKE SELECT ON shelters FROM anon;
GRANT SELECT (
  id, name, city, state, zip,
  transports, transport_states, transport_note, created_at
) ON shelters TO anon;

-- shelter_members: users see own memberships (powers ShelterGate)
DROP POLICY IF EXISTS "Users can view own shelter memberships" ON shelter_members;
CREATE POLICY "Users can view own shelter memberships" ON shelter_members
  FOR SELECT USING (auth.uid() = user_id);

-- pets: signed-in users can read (application dropdown + tracker context)
DROP POLICY IF EXISTS "Authenticated users can view pets" ON pets;
CREATE POLICY "Authenticated users can view pets" ON pets
  FOR SELECT TO authenticated USING (true);

-- pets: public browse of available animals only (#112)
DROP POLICY IF EXISTS "Public can view available pets" ON pets;
CREATE POLICY "Public can view available pets" ON pets
  FOR SELECT TO anon
  USING (status = 'available');


-- pets: shelter staff manage their shelter's animals (#110)
DROP POLICY IF EXISTS "Shelter staff insert pets" ON pets;
CREATE POLICY "Shelter staff insert pets" ON pets
  FOR INSERT TO authenticated
  WITH CHECK (is_shelter_staff(shelter_id));

DROP POLICY IF EXISTS "Shelter staff update pets" ON pets;
CREATE POLICY "Shelter staff update pets" ON pets
  FOR UPDATE TO authenticated
  USING (is_shelter_staff(shelter_id))
  WITH CHECK (is_shelter_staff(shelter_id));

DROP POLICY IF EXISTS "Shelter staff delete pets" ON pets;
CREATE POLICY "Shelter staff delete pets" ON pets
  FOR DELETE TO authenticated
  USING (is_shelter_staff(shelter_id));

ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view pet photos for available pets" ON pet_photos;
CREATE POLICY "Public view pet photos for available pets" ON pet_photos
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND p.status = 'available'
    )
  );

DROP POLICY IF EXISTS "Authenticated view pet photos" ON pet_photos;
CREATE POLICY "Authenticated view pet photos" ON pet_photos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Shelter staff manage pet photos" ON pet_photos;
CREATE POLICY "Shelter staff manage pet photos" ON pet_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND is_shelter_staff(p.shelter_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND is_shelter_staff(p.shelter_id)
    )
  );

-- pet-photos storage: first path segment = shelter_id (#110)
-- Uses split_part (not storage.foldername) — same rationale as avatars.
DROP POLICY IF EXISTS "Shelter staff upload pet photos" ON storage.objects;
CREATE POLICY "Shelter staff upload pet photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pet-photos' AND
  is_shelter_staff(split_part(name, '/', 1)::uuid)
);

DROP POLICY IF EXISTS "Shelter staff update pet photos" ON storage.objects;
CREATE POLICY "Shelter staff update pet photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pet-photos' AND
  is_shelter_staff(split_part(name, '/', 1)::uuid)
);

DROP POLICY IF EXISTS "Shelter staff delete pet photos" ON storage.objects;
CREATE POLICY "Shelter staff delete pet photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pet-photos' AND
  is_shelter_staff(split_part(name, '/', 1)::uuid)
);

DROP POLICY IF EXISTS "Anyone can view pet photos" ON storage.objects;
CREATE POLICY "Anyone can view pet photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pet-photos');

-- adopter_profiles: strictly own-row; shelter staff never read it
-- (they see applications.profile_snapshot instead — Principle III)
DROP POLICY IF EXISTS "Users view own adopter profile" ON adopter_profiles;
CREATE POLICY "Users view own adopter profile" ON adopter_profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users create own adopter profile" ON adopter_profiles;
CREATE POLICY "Users create own adopter profile" ON adopter_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own adopter profile" ON adopter_profiles;
CREATE POLICY "Users update own adopter profile" ON adopter_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- applications: adopters see own; staff see their shelter's.
-- INSERT only as yourself, only at 'submitted', only for an available pet
-- whose shelter matches. NO UPDATE/DELETE policies — RPCs are the write path.
DROP POLICY IF EXISTS "Adopters view own applications" ON applications;
CREATE POLICY "Adopters view own applications" ON applications
  FOR SELECT USING (auth.uid() = adopter_id);
DROP POLICY IF EXISTS "Shelter staff view shelter applications" ON applications;
CREATE POLICY "Shelter staff view shelter applications" ON applications
  FOR SELECT USING (is_shelter_staff(shelter_id));
DROP POLICY IF EXISTS "Adopters submit own applications" ON applications;
CREATE POLICY "Adopters submit own applications" ON applications
  FOR INSERT WITH CHECK (
    auth.uid() = adopter_id
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_id
        AND p.shelter_id = applications.shelter_id
        AND p.status = 'available'
    )
  );

-- status history: readable by the application's parties; written only by
-- SECURITY DEFINER functions (no client INSERT/UPDATE/DELETE policies)
DROP POLICY IF EXISTS "Application parties view status history" ON application_status_history;
CREATE POLICY "Application parties view status history" ON application_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id
        AND (a.adopter_id = auth.uid() OR is_shelter_staff(a.shelter_id))
    )
  );

-- ─── Configurable application: question bank, saved answers (#337) ──────────
-- Spec: features/core-features/049-configurable-application/
-- Content: docs/prp-docs/configurable-application-prp.md
-- Principle III: a rescue reads only answers to questions it showed, frozen
-- into applications.answers_snapshot by the database at submit time.

CREATE TABLE IF NOT EXISTS application_questions (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z]+(\.[a-z_]+)+$'),
  category TEXT NOT NULL CHECK (category IN
    ('contact', 'application', 'eligibility', 'household', 'housing', 'yard',
     'pets', 'vet', 'references', 'lifestyle', 'training', 'scenarios',
     'pet_specific')),
  sort_order SMALLINT NOT NULL UNIQUE,
  wording TEXT NOT NULL CHECK (length(wording) BETWEEN 2 AND 500),
  answer_type TEXT NOT NULL CHECK (answer_type IN
    ('text', 'long_text', 'yes_no', 'choice', 'multi_choice', 'number',
     'date', 'phone', 'email', 'address', 'contact', 'group', 'repeat',
     'repeat_field', 'pet')),
  choices JSONB CHECK (choices IS NULL OR jsonb_typeof(choices) = 'array'),
  fields JSONB CHECK (fields IS NULL OR jsonb_typeof(fields) = 'array'),
  follow_up JSONB CHECK (follow_up IS NULL OR jsonb_typeof(follow_up) = 'object'),
  show_if JSONB CHECK (show_if IS NULL OR jsonb_typeof(show_if) = 'object'),
  parent_id TEXT REFERENCES application_questions(id),
  species TEXT NOT NULL DEFAULT 'any' CHECK (species IN ('any', 'dog', 'cat')),
  pet_tag TEXT CHECK (pet_tag IN
    ('sighthound', 'bully_breed', 'large_dog', 'escape_risk', 'senior',
     'special_needs')),
  sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity IN
    ('normal', 'sensitive', 'third_party')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_flaggable BOOLEAN NOT NULL DEFAULT FALSE,
  always_optional BOOLEAN NOT NULL DEFAULT FALSE,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT repeat_field_has_parent CHECK ((answer_type = 'repeat_field') = (parent_id IS NOT NULL))
);

COMMENT ON TABLE application_questions IS 'Shared master question bank (#337). ids are stable and never reused; edit wording here, never in a rescue. Locked questions are always on every application.';

CREATE TABLE IF NOT EXISTS shelter_application_questions (
  shelter_id UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  shown BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shelter_id, question_id)
);

COMMENT ON TABLE shelter_application_questions IS 'Which non-locked bank questions a rescue shows (#337). No row = hidden. Managers write only through set_shelter_application_questions.';

CREATE TABLE IF NOT EXISTS adopter_answers (
  adopter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  value JSONB NOT NULL CHECK (octet_length(value::text) <= 20000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (adopter_id, question_id)
);

COMMENT ON TABLE adopter_answers IS 'Answer once, reuse everywhere (#337). Strictly own-row; shelter staff never read it and see applications.answers_snapshot instead (Principle III).';

DROP TRIGGER IF EXISTS update_shelter_application_questions_updated_at ON shelter_application_questions;
CREATE TRIGGER update_shelter_application_questions_updated_at
  BEFORE UPDATE ON shelter_application_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_adopter_answers_updated_at ON adopter_answers;
CREATE TRIGGER update_adopter_answers_updated_at
  BEFORE UPDATE ON adopter_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS answers_snapshot JSONB
  CHECK (answers_snapshot IS NULL OR jsonb_typeof(answers_snapshot) = 'array');

COMMENT ON COLUMN applications.answers_snapshot IS 'Questions the rescue showed at submit time, with wording and the adopter''s answers (#337). Always written by set_application_answers_snapshot; NULL for applications submitted before #337.';

-- Adopter may omit saved third-party answers (references) from this rescue's
-- copy when they decline to share on the review step (#446).
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS snapshot_omit_question_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN applications.snapshot_omit_question_ids IS
  'Question ids left out of answers_snapshot at submit (adopter declined to share). Written by the adopter on INSERT; never edited afterward.';

ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE adopter_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read the question bank" ON application_questions;
CREATE POLICY "Anyone can read the question bank" ON application_questions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Signed-in users read rescue question choices" ON shelter_application_questions;
CREATE POLICY "Signed-in users read rescue question choices" ON shelter_application_questions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users view own answers" ON adopter_answers;
CREATE POLICY "Users view own answers" ON adopter_answers
  FOR SELECT USING (auth.uid() = adopter_id);
DROP POLICY IF EXISTS "Users create own answers" ON adopter_answers;
CREATE POLICY "Users create own answers" ON adopter_answers
  FOR INSERT WITH CHECK (auth.uid() = adopter_id);
DROP POLICY IF EXISTS "Users update own answers" ON adopter_answers;
CREATE POLICY "Users update own answers" ON adopter_answers
  FOR UPDATE USING (auth.uid() = adopter_id) WITH CHECK (auth.uid() = adopter_id);
DROP POLICY IF EXISTS "Users delete own answers" ON adopter_answers;
CREATE POLICY "Users delete own answers" ON adopter_answers
  FOR DELETE USING (auth.uid() = adopter_id);

-- Bank content. ON CONFLICT DO UPDATE so wording fixes are a re-run; retired_at
-- is left alone. sort_order: category blocks of 100.
INSERT INTO application_questions
  (id, category, sort_order, wording, answer_type, choices, fields, follow_up, show_if, parent_id,
   species, pet_tag, sensitivity, is_locked, is_flaggable, always_optional)
VALUES
  -- Contact
  ('con.full_name', 'contact', 101, 'Full name', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('con.email', 'contact', 102, 'Email address', 'email', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('con.email_secondary', 'contact', 103, 'Secondary email', 'email', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  ('con.phone', 'contact', 104, 'Phone', 'phone', '[{"value":"mobile","label":"Mobile"},{"value":"home","label":"Home"},{"value":"work","label":"Work"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('con.phone_secondary', 'contact', 105, 'Secondary phone', 'phone', '[{"value":"mobile","label":"Mobile"},{"value":"home","label":"Home"},{"value":"work","label":"Work"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  ('con.address', 'contact', 106, 'Home address', 'address', NULL, '[{"key":"street","label":"Street address","type":"text"},{"key":"unit","label":"Apartment or unit","type":"text"},{"key":"city","label":"City","type":"text"},{"key":"state","label":"State","type":"text"},{"key":"zip","label":"ZIP","type":"text"}]', NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('con.county', 'contact', 107, 'County', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  ('con.mailing_address', 'contact', 108, 'Mailing address, if different', 'address', NULL, '[{"key":"street","label":"Street address","type":"text"},{"key":"unit","label":"Apartment or unit","type":"text"},{"key":"city","label":"City","type":"text"},{"key":"state","label":"State","type":"text"},{"key":"zip","label":"ZIP","type":"text"}]', NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  ('con.preferred_contact', 'contact', 109, 'Preferred way to contact you', 'choice', '[{"value":"email","label":"Email"},{"value":"phone","label":"Phone call"},{"value":"text","label":"Text message"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  -- This application (answered fresh each time, never reused)
  ('app.pet_interest', 'application', 201, 'Which pet are you applying for?', 'pet', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('app.why_this_pet', 'application', 202, 'Why this pet?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('app.heard_about', 'application', 203, 'How did you hear about us?', 'choice', '[{"value":"petfinder","label":"Petfinder"},{"value":"adopt_a_pet","label":"Adopt-a-Pet"},{"value":"facebook","label":"Facebook"},{"value":"instagram","label":"Instagram"},{"value":"friend_family","label":"Friend or family"},{"value":"other_website","label":"Other website"},{"value":"other","label":"Other"}]', NULL, '{"when":["other_website","other"],"label":"Please specify"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('app.adopted_from_us', 'application', 204, 'Have you adopted from us before?', 'yes_no', NULL, NULL, '{"when":[true],"label":"When, and which pet?"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('app.surrendered_to_us', 'application', 205, 'Have you ever surrendered an animal to us?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  -- Eligibility
  ('elg.date_of_birth', 'eligibility', 301, 'Date of birth', 'date', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('elg.cruelty_conviction', 'eligibility', 302, 'Have you ever been convicted of abuse or neglect of a child or an animal?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('elg.application_rejected', 'eligibility', 303, 'Have you ever had an adoption application rejected by a rescue or shelter?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  -- Household
  ('hh.adults_count', 'household', 401, 'How many adults live in your home?', 'number', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('hh.children_count', 'household', 402, 'How many children live in your home?', 'number', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('hh.members', 'household', 403, 'Everyone who lives in your home: their relationship to you and age', 'repeat', NULL, '[{"key":"relationship","label":"Relationship to you","type":"text"},{"key":"age","label":"Age","type":"number"}]', NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('hh.all_agree', 'household', 404, 'Does every adult in your home know you are applying and agree to the adoption?', 'yes_no', NULL, NULL, '{"when":[false],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('hh.primary_caregiver', 'household', 405, 'Who will be the pet''s primary caregiver?', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('hh.allergies', 'household', 406, 'Does anyone in your home have pet allergies or asthma?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('hh.children_experience', 'household', 407, 'Describe your children''s experience with pets and how you will supervise them together.', 'long_text', NULL, NULL, NULL, '{"question":"hh.children_count","gt":0}', NULL, 'any', NULL, 'sensitive', FALSE, FALSE, FALSE),
  ('hh.visitors', 'household', 408, 'Who visits your home regularly?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('hh.pet_for', 'household', 409, 'Who is this pet for?', 'choice', '[{"value":"me","label":"Me"},{"value":"household","label":"My household"},{"value":"gift","label":"Someone else, as a gift"}]', NULL, '{"when":["gift"],"label":"Who is it for?"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  -- Housing & Landlord
  ('hou.home_type', 'housing', 501, 'What type of home do you live in?', 'choice', '[{"value":"house","label":"House"},{"value":"townhouse","label":"Townhouse"},{"value":"apartment","label":"Apartment"},{"value":"condo","label":"Condo"},{"value":"duplex","label":"Duplex"},{"value":"mobile_home","label":"Mobile home"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('hou.own_rent', 'housing', 502, 'Do you own or rent your home?', 'choice', '[{"value":"own","label":"Own"},{"value":"rent","label":"Rent"},{"value":"family_other","label":"Live with family or other"}]', NULL, '{"when":["family_other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('hou.landlord_allows', 'housing', 503, 'Does your landlord allow this pet?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"not_asked","label":"Not asked yet"}]', NULL, NULL, '{"question":"hou.own_rent","in":["rent"]}', NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('hou.landlord_contact', 'housing', 504, 'Landlord or property manager: name and phone', 'contact', NULL, '[{"key":"name","label":"Name","type":"text"},{"key":"phone","label":"Phone","type":"phone"}]', NULL, '{"question":"hou.own_rent","in":["rent"]}', NULL, 'any', NULL, 'third_party', TRUE, TRUE, FALSE),
  ('hou.restrictions', 'housing', 505, 'Does your landlord, HOA, or neighborhood have pet restrictions?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Describe them (number of pets, size or weight, breeds, deposits or fees)"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('hou.insurance_breed', 'housing', 506, 'Does your homeowner''s or renter''s insurance restrict any breeds or sizes?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"dont_know","label":"Don''t know"}]', NULL, '{"when":["yes"],"label":"Please explain"}', NULL, NULL, 'dog', NULL, 'normal', FALSE, TRUE, FALSE),
  ('hou.breed_legislation', 'housing', 507, 'Does your city or county have breed-specific laws or restrictions?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"dont_know","label":"Don''t know"}]', NULL, '{"when":["yes"],"label":"Please explain"}', NULL, NULL, 'dog', NULL, 'normal', FALSE, TRUE, FALSE),
  ('hou.area_type', 'housing', 508, 'What type of area do you live in?', 'choice', '[{"value":"urban","label":"Urban"},{"value":"suburban","label":"Suburban"},{"value":"rural","label":"Rural"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('hou.time_at_address', 'housing', 509, 'How long have you lived at your current address?', 'choice', '[{"value":"under_1","label":"Under 1 year"},{"value":"1_3","label":"1 to 3 years"},{"value":"3_plus","label":"3 years or more"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('hou.moving_soon', 'housing', 510, 'Do you expect to move in the next 6 months?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('hou.neighbor_issues', 'housing', 511, 'Have you had any issues with neighbors about pets?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  -- Yard & Containment
  ('yrd.has_yard', 'yard', 601, 'Do you have a yard?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('yrd.fenced', 'yard', 602, 'Is your yard fenced?', 'choice', '[{"value":"fully","label":"Fully"},{"value":"partly","label":"Partly"},{"value":"no","label":"No"}]', NULL, NULL, '{"question":"yrd.has_yard","in":[true]}', NULL, 'any', NULL, 'normal', TRUE, TRUE, FALSE),
  ('yrd.fence_details', 'yard', 603, 'Fence height and type (for example: 6 ft wood)', 'text', NULL, NULL, NULL, '{"question":"yrd.fenced","in":["fully","partly"]}', NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('yrd.other_containment', 'yard', 604, 'Do you use any other outdoor containment?', 'multi_choice', '[{"value":"none","label":"None"},{"value":"electric_fence","label":"Underground or electric fence"},{"value":"kennel_run","label":"Outdoor kennel or dog run"},{"value":"tie_out","label":"Tie-out or chain"},{"value":"other","label":"Other"}]', NULL, '{"when":["electric_fence","kennel_run","tie_out","other"],"label":"How would it be used?"}', NULL, NULL, 'dog', NULL, 'normal', FALSE, TRUE, FALSE),
  ('yrd.no_fence_plan', 'yard', 605, 'If you don''t have a fenced yard, how will the dog go outside?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('yrd.outdoor_supervision', 'yard', 606, 'How will you supervise the pet''s time outdoors?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('yrd.indoor_outdoor', 'yard', 607, 'Will the pet live indoors, outdoors, or both?', 'choice', '[{"value":"indoors","label":"Indoors"},{"value":"outdoors","label":"Outdoors"},{"value":"both","label":"Both"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('yrd.cat_outdoor_access', 'yard', 608, 'Will your cat go outdoors?', 'choice', '[{"value":"never","label":"Never"},{"value":"enclosed","label":"Screened porch or catio only"},{"value":"supervised","label":"Supervised"},{"value":"free","label":"Free access"}]', NULL, '{"when":["supervised","free"],"label":"About how many hours a day?"}', NULL, NULL, 'cat', NULL, 'normal', FALSE, TRUE, FALSE),
  ('yrd.pet_door', 'yard', 609, 'Will the pet have access to a pet door?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"future","label":"In the future"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('yrd.window_screens', 'yard', 610, 'Do your windows have screens?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"some","label":"Some"}]', NULL, NULL, NULL, NULL, 'cat', NULL, 'normal', FALSE, TRUE, FALSE),
  -- Current & Past Pets
  ('pet.current', 'pets', 701, 'Pets living in your home now, including pets that belong to roommates or family', 'repeat', NULL, '[{"key":"name","label":"Name","type":"text"},{"key":"species","label":"Species","type":"text"},{"key":"breed","label":"Breed","type":"text"},{"key":"age","label":"Age","type":"text"},{"key":"sex","label":"Sex","type":"text"}]', NULL, NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('pet.current.spay_neuter', 'pets', 702, 'Is this pet spayed or neutered?', 'repeat_field', NULL, '[{"key":"spay_neuter","label":"Spayed or neutered?","type":"yes_no"},{"key":"spay_neuter_explain","label":"If not, why?","type":"text"}]', NULL, NULL, 'pet.current', 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.current.vaccines', 'pets', 703, 'Is this pet current on vaccinations?', 'repeat_field', NULL, '[{"key":"vaccines","label":"Current on vaccinations?","type":"yes_no"},{"key":"vaccines_explain","label":"If not, why?","type":"text"}]', NULL, NULL, 'pet.current', 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.current.heartworm', 'pets', 704, 'Is this dog on heartworm prevention?', 'repeat_field', NULL, '[{"key":"heartworm","label":"On heartworm prevention?","type":"yes_no"},{"key":"heartworm_explain","label":"If not, why?","type":"text"}]', NULL, NULL, 'pet.current', 'dog', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.current.microchip', 'pets', 705, 'Is this pet microchipped?', 'repeat_field', NULL, '[{"key":"microchip","label":"Microchipped?","type":"yes_no"}]', NULL, NULL, 'pet.current', 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('pet.current.declawed', 'pets', 706, 'Is this cat declawed?', 'repeat_field', NULL, '[{"key":"declawed","label":"Declawed?","type":"yes_no"}]', NULL, NULL, 'pet.current', 'cat', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.current.details', 'pets', 707, 'How long you''ve had this pet and where it''s kept', 'repeat_field', NULL, '[{"key":"how_long","label":"How long you''ve had them","type":"text"},{"key":"where_kept","label":"Where kept (indoors, outdoors, both)","type":"text"}]', NULL, NULL, 'pet.current', 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('pet.current.food', 'pets', 708, 'Type and brand of food', 'repeat_field', NULL, '[{"key":"food","label":"Food type and brand","type":"text"}]', NULL, NULL, 'pet.current', 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('pet.current_adjust', 'pets', 709, 'How do you think your current pets will adjust to a new pet?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('pet.past', 'pets', 710, 'Pets you''ve owned in the past 5 years that no longer live with you', 'repeat', NULL, '[{"key":"name","label":"Name","type":"text"},{"key":"species","label":"Species","type":"text"},{"key":"age","label":"Age","type":"text"},{"key":"when_left","label":"When they left","type":"text"},{"key":"outcome","label":"What happened","type":"choice","choices":[{"value":"died","label":"Died"},{"value":"rehomed","label":"Rehomed"},{"value":"returned","label":"Returned to a rescue or shelter"},{"value":"lost","label":"Lost"},{"value":"other","label":"Other"}]},{"key":"explain","label":"Please explain (if died, the cause if known)","type":"text"}]', NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.ever_given_up', 'pets', 711, 'Have you ever given up, rehomed, or returned a pet?', 'yes_no', NULL, NULL, '{"when":[true],"label":"What happened, what you tried first, and where the pet went"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('pet.euthanized_non_medical', 'pets', 712, 'Have you ever had a pet euthanized for reasons other than illness or old age?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please explain"}', NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('pet.adopted_before', 'pets', 713, 'Have you adopted from a rescue or shelter before?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Which group(s)?"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('pet.moved_with_pets', 'pets', 714, 'Have you moved with pets before? What happened?', 'choice', '[{"value":"not_moved","label":"Haven''t moved with pets"},{"value":"took_with","label":"Took them with me"},{"value":"gave_family","label":"Gave to friend or family"},{"value":"shelter","label":"Took to a shelter"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  -- Veterinarian
  ('vet.contact', 'vet', 801, 'Current or previous veterinarian or clinic: name and phone', 'contact', NULL, '[{"key":"name","label":"Vet or clinic name","type":"text"},{"key":"phone","label":"Phone","type":"phone"},{"key":"no_vet","label":"I don''t have a vet","type":"yes_no"}]', NULL, NULL, NULL, 'any', NULL, 'third_party', TRUE, TRUE, FALSE),
  ('vet.how_long', 'vet', 802, 'How long have you used this vet?', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('vet.need_help', 'vet', 803, 'If you don''t have a vet, would you like help finding one?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  -- References
  ('ref.personal', 'references', 901, 'Personal references who can speak about you as a pet owner or caregiver', 'repeat', NULL, '[{"key":"name","label":"Name","type":"text"},{"key":"phone","label":"Phone","type":"phone"},{"key":"relationship","label":"Relationship to you","type":"text"},{"key":"years_known","label":"How long they''ve known you","type":"text"}]', NULL, NULL, NULL, 'any', NULL, 'third_party', FALSE, TRUE, FALSE),
  -- Lifestyle & Schedule
  ('lif.hours_alone', 'lifestyle', 1001, 'On a typical day, how many hours will the pet be home alone?', 'number', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.where_when_away', 'lifestyle', 1002, 'Where will the pet stay when nobody is home?', 'choice', '[{"value":"loose","label":"Loose in the house"},{"value":"one_room","label":"One room"},{"value":"crate","label":"Crate"},{"value":"yard","label":"Yard"},{"value":"garage","label":"Garage"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.sleep', 'lifestyle', 1003, 'Where will the pet sleep at night?', 'choice', '[{"value":"bedroom","label":"Bedroom"},{"value":"elsewhere_inside","label":"Elsewhere in the house"},{"value":"crate","label":"Crate"},{"value":"garage","label":"Garage"},{"value":"outdoors","label":"Outdoors"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.schedule', 'lifestyle', 1004, 'Describe your work or school schedule, including whether you work from home and how long you''re usually away', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.employment_status', 'lifestyle', 1005, 'Employment status', 'choice', '[{"value":"full_time","label":"Full-time"},{"value":"part_time","label":"Part-time"},{"value":"self_employed","label":"Self-employed or work from home"},{"value":"student","label":"Student"},{"value":"retired","label":"Retired"},{"value":"not_employed","label":"Not employed"},{"value":"other","label":"Other"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, FALSE, FALSE),
  ('lif.employer', 'lifestyle', 1006, 'Employer or school, and occupation', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, FALSE, FALSE),
  ('lif.typical_day', 'lifestyle', 1007, 'What would a typical day look like with your pet?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.activity_level', 'lifestyle', 1008, 'How active is your home?', 'choice', '[{"value":"very","label":"Very active"},{"value":"moderate","label":"Moderately active"},{"value":"quiet","label":"Quiet"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.lifestyle', 'lifestyle', 1009, 'Describe your lifestyle (for example: travel, stay-at-home parent, retired, active)', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.exercise', 'lifestyle', 1010, 'How will you exercise the dog, and how often?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.furniture', 'lifestyle', 1011, 'Will the pet be allowed on furniture?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"some","label":"Some furniture"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.care_when_away', 'lifestyle', 1012, 'Who will care for the pet when you travel?', 'choice', '[{"value":"family_friend","label":"Family or friend"},{"value":"sitter","label":"Pet sitter"},{"value":"boarding","label":"Boarding"},{"value":"travels_with_me","label":"Travels with me"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.emergency_plan', 'lifestyle', 1013, 'What arrangements will you make for the pet in an emergency?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.moving_plan', 'lifestyle', 1014, 'If you move, what will you do with the pet?', 'choice', '[{"value":"moves_with_me","label":"The pet moves with me"},{"value":"not_sure","label":"Not sure"},{"value":"other","label":"Other"}]', NULL, '{"when":["not_sure","other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.future_changes', 'lifestyle', 1015, 'Any major life changes you expect in the next 5 to 10 years (moving, children, career)?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.costs_responsible', 'lifestyle', 1016, 'Who in your household pays for vet care, emergencies, food, training, and grooming?', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.budget', 'lifestyle', 1017, 'Basic care for a pet can cost $1,000 or more a year, not including emergencies. Are you able to take on that cost?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, TRUE, FALSE),
  ('lif.truck_bed', 'lifestyle', 1018, 'If you drive a pickup truck, would the dog ride in the bed?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"no_truck","label":"I don''t have a truck"}]', NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.litter_box', 'lifestyle', 1019, 'Where will the litter box be kept?', 'text', NULL, NULL, NULL, NULL, NULL, 'cat', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.declaw_plan', 'lifestyle', 1020, 'Are you planning to declaw?', 'choice', '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"unsure","label":"Unsure"}]', NULL, '{"when":["yes","unsure"],"label":"Please explain why"}', NULL, NULL, 'cat', NULL, 'normal', FALSE, TRUE, FALSE),
  ('lif.food_plan', 'lifestyle', 1021, 'What food do you plan to feed?', 'text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.reason_adopting', 'lifestyle', 1022, 'Main reason you want a pet', 'multi_choice', '[{"value":"companion","label":"Companion"},{"value":"exercise_buddy","label":"Exercise buddy"},{"value":"lap_pet","label":"Lap pet"},{"value":"companion_for_pet","label":"Companion for another pet"},{"value":"working","label":"Working or hunting dog"},{"value":"assistance","label":"Service or emotional support animal"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.looking_for', 'lifestyle', 1023, 'What personality and traits are you looking for?', 'multi_choice', '[{"value":"active","label":"Active"},{"value":"mellow","label":"Mellow"},{"value":"playful","label":"Playful"},{"value":"affectionate","label":"Affectionate"},{"value":"lap_loving","label":"Lap-loving"},{"value":"good_with_dogs","label":"Good with dogs"},{"value":"good_with_cats","label":"Good with cats"},{"value":"good_with_kids","label":"Good with kids"},{"value":"single_pet","label":"Single-pet home"},{"value":"shy","label":"Shy, needs a friend"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.preferences', 'lifestyle', 1024, 'Preferred size, age, and sex', 'group', NULL, '[{"key":"size","label":"Size","type":"choice","choices":[{"value":"small","label":"Small"},{"value":"medium","label":"Medium"},{"value":"large","label":"Large"},{"value":"extra_large","label":"Extra large"},{"value":"no_preference","label":"No preference"}]},{"key":"age","label":"Age","type":"choice","choices":[{"value":"baby","label":"Baby"},{"value":"young","label":"Young"},{"value":"adult","label":"Adult"},{"value":"senior","label":"Senior"},{"value":"no_preference","label":"No preference"}]},{"key":"sex","label":"Sex","type":"choice","choices":[{"value":"male","label":"Male"},{"value":"female","label":"Female"},{"value":"no_preference","label":"No preference"}]}]', NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('lif.assistance_role', 'lifestyle', 1025, 'Will this pet need to be trained as a service animal or emotional support animal?', 'choice', '[{"value":"no","label":"No"},{"value":"service","label":"Service animal"},{"value":"esa","label":"Emotional support animal"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'sensitive', FALSE, FALSE, FALSE),
  ('lif.anything_else', 'lifestyle', 1026, 'Anything else we should know?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  -- Training & Experience
  ('trn.experience_level', 'training', 1101, 'Your experience with this kind of pet', 'choice', '[{"value":"beginner","label":"Beginner: my first one as an adult"},{"value":"moderate","label":"Moderate: 1 or 2 as an adult, some basic training"},{"value":"advanced","label":"Advanced: several, including behavior challenges"},{"value":"raised_young","label":"I have raised puppies or kittens"}]', NULL, '{"always":true,"label":"Describe your experience"}', NULL, NULL, 'any', NULL, 'normal', TRUE, FALSE, FALSE),
  ('trn.decompression', 'training', 1102, 'How long do you expect to give a newly adopted pet to settle in (decompress)?', 'choice', '[{"value":"few_days","label":"A few days"},{"value":"1_2_weeks","label":"1 to 2 weeks"},{"value":"3_4_weeks","label":"3 to 4 weeks"},{"value":"1_3_months","label":"1 to 3 months"},{"value":"as_long_as_it_takes","label":"As long as it takes"}]', NULL, '{"always":true,"label":"Anything you would like to add?"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('trn.adjustment_signs', 'training', 1103, 'What changes in behavior would you consider normal while the pet adjusts, and when would you seek help?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.crate', 'training', 1104, 'What is your experience with crate training, and how will you use a crate?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.house_training', 'training', 1105, 'How would you handle house-training, accidents, or regression?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.destructive', 'training', 1106, 'How would you handle destructive behavior?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.behavior_plan', 'training', 1107, 'If a behavior problem comes up that is difficult for your household, what would you do?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.methods', 'training', 1108, 'What training methods and tools would you use, and any you would not? Would you work with a trainer or behavior professional if needed?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('trn.obedience_class', 'training', 1109, 'If you plan to take an obedience class, where?', 'text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, TRUE),
  ('trn.hard_behaviors', 'training', 1110, 'Which pet behaviors would be hardest for you to live with?', 'multi_choice', '[{"value":"barking","label":"Barking"},{"value":"chewing","label":"Chewing"},{"value":"house_soiling","label":"House-soiling"},{"value":"jumping","label":"Jumping"},{"value":"fear","label":"Shyness or fear"},{"value":"separation_anxiety","label":"Separation anxiety"},{"value":"scratching","label":"Scratching furniture"},{"value":"other_pets","label":"Not good with other pets"},{"value":"other","label":"Other"}]', NULL, '{"when":["other"],"label":"Please describe"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('trn.want_to_learn', 'training', 1111, 'I would like to learn more about…', 'multi_choice', '[{"value":"crate_training","label":"Crate training"},{"value":"house_training","label":"House training"},{"value":"litter_box","label":"Litter box training"},{"value":"finding_vet","label":"Finding a vet"},{"value":"heartworm","label":"Heartworm"},{"value":"obedience","label":"Obedience training"},{"value":"pet_insurance","label":"Pet insurance"},{"value":"new_pet_care","label":"Caring for my new pet"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, TRUE),
  ('trn.ready_when', 'training', 1112, 'How soon are you ready to bring your new pet home?', 'choice', '[{"value":"now","label":"Right away"},{"value":"2_weeks","label":"Within 2 weeks"},{"value":"month","label":"Within a month"},{"value":"flexible","label":"Flexible"}]', NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  -- Scenarios
  ('scn.give_up_reasons', 'scenarios', 1201, 'What would make you consider giving up or returning a pet?', 'multi_choice', '[{"value":"destructive","label":"Chewing or destructive"},{"value":"not_house_trained","label":"Not house-trained"},{"value":"medical","label":"Medical issues"},{"value":"other_pets","label":"Not getting along with other pets"},{"value":"children","label":"Not good with children"},{"value":"escaping","label":"Escaping"},{"value":"moving","label":"Moving"},{"value":"too_big","label":"Pet gets too big"},{"value":"new_baby","label":"New baby"},{"value":"landlord","label":"Landlord issues"},{"value":"allergies","label":"Allergies"},{"value":"bite","label":"Bit someone"},{"value":"nothing","label":"Nothing"},{"value":"other","label":"Other"}]', NULL, '{"always":true,"label":"Please be specific"}', NULL, NULL, 'any', NULL, 'normal', FALSE, TRUE, FALSE),
  ('scn.growl_child', 'scenarios', 1202, 'Two weeks in, your dog growls when a child pulls its ears. What would you do?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.rough_start', 'scenarios', 1203, 'Three weeks in, the pet has had accidents, chewed something valuable, and still isn''t settled. How would you handle it?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.life_change', 'scenarios', 1204, 'If your living situation or household changed (move, new baby, marriage or divorce, job change, deployment), what would you do with your pet?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.unexpected_behavior', 'scenarios', 1205, 'The pet shows a behavior you didn''t expect (barking, fear, resource guarding, separation anxiety, trouble with another pet). What would you do first?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.vet_bill', 'scenarios', 1206, 'Your vet recommends an unexpected treatment costing $1,000 to $2,000. How would you approach it?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.frustration', 'scenarios', 1207, 'Tell us about a time a pet frustrated or surprised you. What happened and how did you handle it?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.resource_guarding', 'scenarios', 1208, 'Your dog growls when you take away a toy, food, or other valued item. What would you do?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', NULL, 'normal', FALSE, FALSE, FALSE),
  ('scn.bite', 'scenarios', 1209, 'Your pet bites or tries to bite a person or another animal. What would you do next?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', NULL, 'normal', FALSE, FALSE, FALSE),
  -- Pet-specific (shown only for pets the rescue has tagged)
  ('pts.sight.stairs', 'pet_specific', 1301, 'Are there stairs in your home? What kind?', 'choice', '[{"value":"none","label":"No stairs"},{"value":"carpeted","label":"Carpeted"},{"value":"hard","label":"Hard surface"},{"value":"open_back","label":"Open-back"}]', NULL, NULL, NULL, NULL, 'dog', 'sighthound', 'normal', FALSE, FALSE, FALSE),
  ('pts.sight.water', 'pet_specific', 1302, 'Is there a swimming pool or open water on or next to your property?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Is it fenced off? Please describe"}', NULL, NULL, 'dog', 'sighthound', 'normal', FALSE, TRUE, FALSE),
  ('pts.sight.crate_muzzle', 'pet_specific', 1303, 'Are you willing to use a crate or muzzle during the adjustment period?', 'yes_no', NULL, NULL, '{"when":[false],"label":"Please explain"}', NULL, NULL, 'dog', 'sighthound', 'normal', FALSE, TRUE, FALSE),
  ('pts.sight.leash_only', 'pet_specific', 1304, 'Do you understand this dog must always be on a leash or in a fully fenced area?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'dog', 'sighthound', 'normal', FALSE, TRUE, FALSE),
  ('pts.bully.dog_intros', 'pet_specific', 1311, 'How would you introduce this dog to other dogs, and would you use dog parks?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', 'bully_breed', 'normal', FALSE, FALSE, FALSE),
  ('pts.bully.public', 'pet_specific', 1312, 'How would you handle neighbors or strangers who are nervous about this type of dog?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'dog', 'bully_breed', 'normal', FALSE, FALSE, FALSE),
  ('pts.large.vehicle', 'pet_specific', 1321, 'Do you have a vehicle that fits a large dog for vet visits?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'dog', 'large_dog', 'normal', FALSE, TRUE, FALSE),
  ('pts.large.handling', 'pet_specific', 1322, 'Can everyone who will walk this dog handle a strong puller?', 'yes_no', NULL, NULL, '{"when":[false],"label":"Please explain"}', NULL, NULL, 'dog', 'large_dog', 'normal', FALSE, TRUE, FALSE),
  ('pts.escape.doors', 'pet_specific', 1331, 'How will you keep the pet from slipping out of doors and gates?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', 'escape_risk', 'normal', FALSE, FALSE, FALSE),
  ('pts.senior.costs', 'pet_specific', 1341, 'Are you prepared for higher vet costs as this pet ages?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', 'senior', 'normal', FALSE, TRUE, FALSE),
  ('pts.senior.mobility', 'pet_specific', 1342, 'Will the pet need to use stairs to go outside or reach where it sleeps?', 'yes_no', NULL, NULL, '{"when":[true],"label":"Please describe"}', NULL, NULL, 'any', 'senior', 'normal', FALSE, FALSE, FALSE),
  ('pts.senior.end_of_life', 'pet_specific', 1343, 'Are you prepared to care for this pet through the end of its life?', 'yes_no', NULL, NULL, '{"when":[false],"label":"Please explain"}', NULL, NULL, 'any', 'senior', 'normal', FALSE, TRUE, FALSE),
  ('pts.medical.medication', 'pet_specific', 1351, 'Can you give daily medication, including pills or injections?', 'yes_no', NULL, NULL, '{"when":[false],"label":"Please explain"}', NULL, NULL, 'any', 'special_needs', 'normal', FALSE, TRUE, FALSE),
  ('pts.medical.budget', 'pet_specific', 1352, 'Can you budget for this pet''s ongoing medical care?', 'yes_no', NULL, NULL, NULL, NULL, NULL, 'any', 'special_needs', 'normal', FALSE, TRUE, FALSE),
  ('pts.medical.routine', 'pet_specific', 1353, 'Who will follow the pet''s care routine (feeding, medication, appointments) day to day?', 'long_text', NULL, NULL, NULL, NULL, NULL, 'any', 'special_needs', 'normal', FALSE, FALSE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  wording = EXCLUDED.wording,
  answer_type = EXCLUDED.answer_type,
  choices = EXCLUDED.choices,
  fields = EXCLUDED.fields,
  follow_up = EXCLUDED.follow_up,
  show_if = EXCLUDED.show_if,
  parent_id = EXCLUDED.parent_id,
  species = EXCLUDED.species,
  pet_tag = EXCLUDED.pet_tag,
  sensitivity = EXCLUDED.sensitivity,
  is_locked = EXCLUDED.is_locked,
  is_flaggable = EXCLUDED.is_flaggable,
  always_optional = EXCLUDED.always_optional;

-- Today's adopter_profiles row → saved answers. Value shapes are documented in
-- features/core-features/049-configurable-application/plan.md.
CREATE OR REPLACE FUNCTION adopter_profile_answers(p adopter_profiles)
RETURNS TABLE (question_id TEXT, value JSONB)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT m.question_id, m.value
  FROM (VALUES
    ('con.full_name', to_jsonb(NULLIF(btrim(p.full_name), ''))),
    ('con.phone', CASE WHEN NULLIF(btrim(p.phone), '') IS NULL THEN NULL
      ELSE jsonb_build_object('number', btrim(p.phone)) END),
    ('con.address', NULLIF(jsonb_strip_nulls(jsonb_build_object(
      'street', NULLIF(btrim(p.address_line), ''),
      'city', NULLIF(btrim(p.city), ''),
      'state', NULLIF(btrim(p.state), ''),
      'zip', NULLIF(btrim(p.zip), ''))), '{}'::jsonb)),
    ('hou.home_type', to_jsonb(CASE p.housing_type
      WHEN 'own_house' THEN 'house'
      WHEN 'rent_house' THEN 'house'
      WHEN 'own_condo' THEN 'condo'
      WHEN 'rent_apartment' THEN 'apartment'
      WHEN 'other' THEN 'other' END)),
    ('hou.own_rent', to_jsonb(CASE
      WHEN p.housing_type LIKE 'own\_%' THEN 'own'
      WHEN p.housing_type LIKE 'rent\_%' THEN 'rent' END)),
    ('hou.landlord_allows', to_jsonb(CASE p.landlord_approval
      WHEN TRUE THEN 'yes' WHEN FALSE THEN 'no' END)),
    ('hou.landlord_contact', CASE WHEN NULLIF(btrim(p.landlord_contact), '') IS NULL THEN NULL
      ELSE jsonb_build_object('note', btrim(p.landlord_contact)) END),
    ('yrd.has_yard', to_jsonb(p.has_yard)),
    ('yrd.fenced', to_jsonb(CASE p.yard_fenced
      WHEN TRUE THEN 'fully' WHEN FALSE THEN 'no' END)),
    ('hh.adults_count', to_jsonb(p.household_adults)),
    ('hh.children_count', to_jsonb(p.household_children)),
    ('pet.current', CASE WHEN NULLIF(btrim(p.other_pets), '') IS NULL THEN NULL
      ELSE jsonb_build_object('rows', '[]'::jsonb, 'legacy_note', btrim(p.other_pets)) END),
    ('vet.contact', NULLIF(jsonb_strip_nulls(jsonb_build_object(
      'name', NULLIF(btrim(p.vet_name), ''),
      'phone', NULLIF(btrim(p.vet_phone), ''))), '{}'::jsonb)),
    ('trn.experience_level', CASE WHEN NULLIF(btrim(p.experience), '') IS NULL THEN NULL
      ELSE jsonb_build_object('level', NULL::text, 'describe', btrim(p.experience)) END)
  ) AS m(question_id, value)
  WHERE m.value IS NOT NULL;
$$;

COMMENT ON FUNCTION adopter_profile_answers(adopter_profiles) IS
  'Maps today''s universal-application columns to bank question ids (#337). Blank columns produce no answer.';

-- While the legacy form is the only writer, every profile save refreshes the
-- mapped saved answers (and clears ones whose column was blanked).
CREATE OR REPLACE FUNCTION sync_adopter_profile_answers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM adopter_answers a
  WHERE a.adopter_id = NEW.id
    AND a.question_id = ANY (ARRAY[
      'con.full_name', 'con.phone', 'con.address', 'hou.home_type',
      'hou.own_rent', 'hou.landlord_allows', 'hou.landlord_contact',
      'yrd.has_yard', 'yrd.fenced', 'hh.adults_count', 'hh.children_count',
      'pet.current', 'vet.contact', 'trn.experience_level'])
    AND NOT EXISTS (
      SELECT 1 FROM adopter_profile_answers(NEW) m
      WHERE m.question_id = a.question_id
    );

  INSERT INTO adopter_answers (adopter_id, question_id, value)
  SELECT NEW.id, m.question_id, m.value
  FROM adopter_profile_answers(NEW) m
  ON CONFLICT (adopter_id, question_id) DO UPDATE
    SET value = EXCLUDED.value
    WHERE adopter_answers.value IS DISTINCT FROM EXCLUDED.value;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_adopter_profile_answers ON adopter_profiles;
CREATE TRIGGER sync_adopter_profile_answers
  AFTER INSERT OR UPDATE ON adopter_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_adopter_profile_answers();

-- One-time carry-over of every existing profile. DO NOTHING keeps any answer
-- already saved, so re-running the migration never overwrites newer answers.
INSERT INTO adopter_answers (adopter_id, question_id, value)
SELECT p.id, m.question_id, m.value
FROM adopter_profiles p
CROSS JOIN LATERAL adopter_profile_answers(p) m
ON CONFLICT (adopter_id, question_id) DO NOTHING;

-- Drop the pre-#446 4-arg signature so only the omit-aware overload remains.
DROP FUNCTION IF EXISTS build_application_answers_snapshot(UUID, UUID, UUID, TEXT);

-- The rescue's questions for this pet, with the adopter's answers. Repeat
-- answers (current pets) keep only the row fields the rescue asked for.
CREATE OR REPLACE FUNCTION build_application_answers_snapshot(
  p_adopter UUID,
  p_shelter UUID,
  p_pet UUID,
  p_why TEXT,
  p_omit_ids TEXT[] DEFAULT '{}'::text[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_species TEXT;
  v_pet_name TEXT;
  v_tags TEXT[];
  v_email TEXT;
  v_result JSONB;
  v_omit TEXT[] := COALESCE(p_omit_ids, '{}'::text[]);
BEGIN
  SELECT species, name, application_tags
    INTO v_species, v_pet_name, v_tags
    FROM pets WHERE id = p_pet;
  SELECT email INTO v_email FROM auth.users WHERE id = p_adopter;

  WITH selected AS (
    SELECT q.*
    FROM application_questions q
    WHERE q.retired_at IS NULL
      AND NOT (q.id = ANY (v_omit))
      AND (
        q.pet_tag IS NULL
        OR q.pet_tag = ANY(COALESCE(v_tags, '{}'))
      )
      AND (q.species = 'any' OR q.species = v_species)
      AND (
        q.is_locked
        OR EXISTS (
          SELECT 1 FROM shelter_application_questions s
          WHERE s.shelter_id = p_shelter
            AND s.question_id = q.id
            AND s.shown
        )
      )
  ),
  repeat_fields AS (
    SELECT parent.id AS question_id,
           COALESCE(parent.fields, '[]'::jsonb) || COALESCE((
             SELECT jsonb_agg(f ORDER BY child.sort_order)
             FROM selected child
             CROSS JOIN LATERAL jsonb_array_elements(child.fields) f
             WHERE child.parent_id = parent.id
           ), '[]'::jsonb) AS fields
    FROM selected parent
    WHERE parent.answer_type = 'repeat'
  ),
  valued AS (
    SELECT q.id, q.category, q.sort_order, q.wording, q.answer_type, q.choices,
           COALESCE(rf.fields, q.fields) AS fields,
           rf.fields AS allowed_fields,
           CASE
             WHEN q.id = 'app.pet_interest' THEN
               CASE WHEN v_pet_name IS NULL THEN NULL
                 ELSE jsonb_build_object('pet_id', p_pet, 'name', v_pet_name) END
             WHEN q.id = 'app.why_this_pet' THEN to_jsonb(NULLIF(btrim(p_why), ''))
             WHEN q.id = 'con.email' THEN to_jsonb(v_email)
             WHEN q.category = 'application' THEN NULL
             ELSE a.value
           END AS raw_value
    FROM selected q
    LEFT JOIN repeat_fields rf ON rf.question_id = q.id
    LEFT JOIN adopter_answers a
      ON a.adopter_id = p_adopter AND a.question_id = q.id
    WHERE q.parent_id IS NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'question_id', v.id,
           'category', v.category,
           'wording', v.wording,
           'answer_type', v.answer_type,
           'choices', v.choices,
           'fields', v.fields,
           'value', CASE
             WHEN v.allowed_fields IS NOT NULL
                  AND jsonb_typeof(v.raw_value -> 'rows') = 'array' THEN
               jsonb_set(v.raw_value, '{rows}', COALESCE((
                 SELECT jsonb_agg(COALESCE((
                   SELECT jsonb_object_agg(e.key, e.value)
                   FROM jsonb_each(r) e
                   WHERE e.key IN (
                     SELECT af ->> 'key'
                     FROM jsonb_array_elements(v.allowed_fields) af
                   )
                 ), '{}'::jsonb))
                 FROM jsonb_array_elements(v.raw_value -> 'rows') r
               ), '[]'::jsonb))
             ELSE v.raw_value
           END
         ) ORDER BY v.sort_order), '[]'::jsonb)
  INTO v_result
  FROM valued v;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION build_application_answers_snapshot(UUID, UUID, UUID, TEXT, TEXT[]) IS
  'Principle III (#337): locked + rescue-shown questions for the pet''s species, with the adopter''s answers. p_omit_ids drops questions the adopter declined to share (#446). The only path by which saved answers reach a rescue.';

REVOKE ALL ON FUNCTION build_application_answers_snapshot(UUID, UUID, UUID, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION adopter_profile_answers(adopter_profiles) FROM PUBLIC, anon, authenticated;

-- Always overwrite: a client cannot add, drop, or edit snapshot answers.
-- A failure must never block a submission; the legacy profile_snapshot is
-- still written by the client, so the warning path loses nothing.
CREATE OR REPLACE FUNCTION set_application_answers_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.answers_snapshot := build_application_answers_snapshot(
      NEW.adopter_id,
      NEW.shelter_id,
      NEW.pet_id,
      NEW.why_this_pet,
      COALESCE(NEW.snapshot_omit_question_ids, '{}'::text[]));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'answers_snapshot build failed for application %: %', NEW.id, SQLERRM;
    NEW.answers_snapshot := NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_application_answers_snapshot ON applications;
CREATE TRIGGER set_application_answers_snapshot
  BEFORE INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION set_application_answers_snapshot();

CREATE OR REPLACE FUNCTION set_shelter_application_questions(
  p_shelter_id UUID,
  p_question_ids TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ids TEXT[] := COALESCE(p_question_ids, '{}');
  v_unknown TEXT;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_shelter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_shelter';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE user_id = v_uid
      AND shelter_id = p_shelter_id
      AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;
  IF COALESCE(cardinality(v_ids), 0) > 200 THEN
    RAISE EXCEPTION 'invalid_questions';
  END IF;

  IF COALESCE(cardinality(v_ids), 0) > 0 THEN
    SELECT q.id INTO v_unknown
    FROM unnest(v_ids) AS q(id)
    LEFT JOIN application_questions a
      ON a.id = q.id AND a.retired_at IS NULL
    WHERE a.id IS NULL
    LIMIT 1;
    IF v_unknown IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_question';
    END IF;
  END IF;

  DELETE FROM shelter_application_questions
  WHERE shelter_id = p_shelter_id;

  INSERT INTO shelter_application_questions (shelter_id, question_id, shown)
  SELECT DISTINCT p_shelter_id, q.id, TRUE
  FROM unnest(v_ids) AS q(id)
  JOIN application_questions a ON a.id = q.id
  WHERE a.is_locked = FALSE
    AND a.retired_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION set_shelter_application_questions(UUID, TEXT[]) IS
  'Manager-only replace of which extra bank questions a rescue shows (#337 phase 2). Locked questions are always shown and are ignored in the payload.';

REVOKE ALL ON FUNCTION set_shelter_application_questions(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_shelter_application_questions(UUID, TEXT[]) TO authenticated;

CREATE TABLE IF NOT EXISTS shelter_application_flags (
  shelter_id UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]',
  comparator TEXT CHECK (
    comparator IS NULL OR comparator IN ('in', 'gt', 'lt', 'age_lt')
  ),
  threshold NUMERIC,
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shelter_id, question_id)
);

COMMENT ON TABLE shelter_application_flags IS 'Per-rescue red-flag rules (#337). Off by default. Managers write only through set/clear RPCs. Never changes application status.';

DROP TRIGGER IF EXISTS update_shelter_application_flags_updated_at ON shelter_application_flags;
CREATE TRIGGER update_shelter_application_flags_updated_at
  BEFORE UPDATE ON shelter_application_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE shelter_application_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shelter staff read own flags" ON shelter_application_flags;
CREATE POLICY "Shelter staff read own flags" ON shelter_application_flags
  FOR SELECT TO authenticated
  USING (is_shelter_staff(shelter_id));

CREATE OR REPLACE FUNCTION set_shelter_application_flag(
  p_shelter_id UUID,
  p_question_id TEXT,
  p_answers JSONB,
  p_comparator TEXT,
  p_threshold NUMERIC,
  p_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_label TEXT := btrim(COALESCE(p_label, ''));
  v_flaggable BOOLEAN;
  v_retired TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_shelter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_shelter';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE user_id = v_uid
      AND shelter_id = p_shelter_id
      AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  SELECT is_flaggable, retired_at
    INTO v_flaggable, v_retired
    FROM application_questions
    WHERE id = p_question_id;
  IF NOT FOUND OR v_retired IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;
  IF v_flaggable IS NOT TRUE THEN
    RAISE EXCEPTION 'not_flaggable';
  END IF;
  IF char_length(v_label) < 1 OR char_length(v_label) > 80 THEN
    RAISE EXCEPTION 'invalid_label';
  END IF;
  IF p_comparator IS NOT NULL
     AND p_comparator NOT IN ('in', 'gt', 'lt', 'age_lt') THEN
    RAISE EXCEPTION 'invalid_rule';
  END IF;
  IF p_comparator IN ('gt', 'lt', 'age_lt') AND p_threshold IS NULL THEN
    RAISE EXCEPTION 'invalid_rule';
  END IF;
  IF COALESCE(p_comparator, 'in') = 'in'
     AND (p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
          OR jsonb_array_length(p_answers) < 1) THEN
    RAISE EXCEPTION 'invalid_rule';
  END IF;

  INSERT INTO shelter_application_flags (
    shelter_id, question_id, answers, comparator, threshold, label
  ) VALUES (
    p_shelter_id,
    p_question_id,
    COALESCE(p_answers, '[]'::jsonb),
    COALESCE(p_comparator, 'in'),
    p_threshold,
    v_label
  )
  ON CONFLICT (shelter_id, question_id) DO UPDATE
    SET answers = EXCLUDED.answers,
        comparator = EXCLUDED.comparator,
        threshold = EXCLUDED.threshold,
        label = EXCLUDED.label;
END;
$$;

CREATE OR REPLACE FUNCTION clear_shelter_application_flag(
  p_shelter_id UUID,
  p_question_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_shelter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_shelter';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM shelter_members
    WHERE user_id = v_uid
      AND shelter_id = p_shelter_id
      AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'not_a_manager';
  END IF;

  DELETE FROM shelter_application_flags
  WHERE shelter_id = p_shelter_id
    AND question_id = p_question_id;
END;
$$;

COMMENT ON FUNCTION set_shelter_application_flag(UUID, TEXT, JSONB, TEXT, NUMERIC, TEXT) IS
  'Manager-only upsert of one red-flag rule (#337). Off by default; never changes status.';
COMMENT ON FUNCTION clear_shelter_application_flag(UUID, TEXT) IS
  'Manager-only removal of a red-flag rule. Applies to applications submitted after the change.';

REVOKE ALL ON FUNCTION set_shelter_application_flag(UUID, TEXT, JSONB, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_shelter_application_flag(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_shelter_application_flag(UUID, TEXT, JSONB, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_shelter_application_flag(UUID, TEXT) TO authenticated;

-- 90 days after close: strip third-party details from the rescue copy only.
-- Adopter-owned adopter_answers are never touched (#448 / 049 US6).
CREATE OR REPLACE FUNCTION purge_closed_application_third_party(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
  v_ids TEXT[];
  v_strip_vet BOOLEAN;
BEGIN
  FOR r IN
    SELECT a.id, a.status, COALESCE(p.status, '') AS pet_status
    FROM applications a
    LEFT JOIN pets p ON p.id = a.pet_id
    WHERE a.status IN ('approved', 'not_selected', 'withdrawn')
      AND a.status_changed_at <= p_now - INTERVAL '90 days'
  LOOP
    v_ids := ARRAY['hou.landlord_contact', 'ref.personal'];
    v_strip_vet := NOT (r.status = 'approved' AND r.pet_status = 'adopted');
    IF v_strip_vet THEN
      v_ids := v_ids || ARRAY['vet.contact'];
    END IF;

    UPDATE applications
    SET
      answers_snapshot = CASE
        WHEN answers_snapshot IS NULL THEN NULL
        ELSE (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN elem->>'question_id' = ANY (v_ids)
                THEN jsonb_set(elem, '{value}', 'null'::jsonb)
              ELSE elem
            END
            ORDER BY ordinality
          ), '[]'::jsonb)
          FROM jsonb_array_elements(answers_snapshot)
            WITH ORDINALITY AS t(elem, ordinality)
        )
      END,
      profile_snapshot = COALESCE(profile_snapshot, '{}'::jsonb)
        || jsonb_build_object('landlord_contact', NULL)
        || CASE
             WHEN v_strip_vet THEN
               jsonb_build_object('vet_name', NULL, 'vet_phone', NULL)
             ELSE '{}'::jsonb
           END
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION purge_closed_application_third_party(TIMESTAMPTZ) IS
  'Staff copy only (#448): 90 days after close, null landlord/references; null vet unless the pet was adopted.';

REVOKE ALL ON FUNCTION purge_closed_application_third_party(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_closed_application_third_party(TIMESTAMPTZ) TO service_role;

-- ─── Realtime: live status tracker ──────────────────────────────────────────
-- REPLICA IDENTITY FULL is required for Realtime UPDATE events; publication
-- membership is required for postgres_changes delivery. Events respect the
-- subscriber's SELECT policies, so adopters only receive their own rows.

ALTER TABLE applications REPLICA IDENTITY FULL;
ALTER TABLE application_status_history REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'application_status_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.application_status_history;
  END IF;
END $$;

-- Commit the transaction - everything succeeded
COMMIT;
