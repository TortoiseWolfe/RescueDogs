/**
 * Send post-verify rescue onboarding email (#316).
 *
 * Invoked by pg_net from queue_rescue_welcome_email() when auth.users
 * email_confirmed_at flips to set (or INSERT already confirmed). Idempotent
 * via user_profiles.welcome_email_sent (claim-then-send).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getEmailSubject,
  getEmailHtml,
  getEmailText,
} from '../_shared/email-templates.ts';

const supabaseUrl =
  Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ??
  Deno.env.get('SUPABASE_URL') ??
  '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const webhookSecret =
  Deno.env.get('RESCUE_WELCOME_WEBHOOK_SECRET') ??
  Deno.env.get('APPLICATION_NOTIFY_WEBHOOK_SECRET');
const siteUrl = (
  Deno.env.get('NEXT_PUBLIC_DEPLOY_URL') ?? 'https://raisedpaws.com'
).replace(/\/$/, '');
const fromEmail =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'Raised Paws <noreply@raisedpaws.com>';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('Authorization');
  if (auth && supabaseServiceKey && auth === `Bearer ${supabaseServiceKey}`) {
    return true;
  }
  const headerSecret = req.headers.get('X-Webhook-Secret');
  if (webhookSecret && headerSecret === webhookSecret) {
    return true;
  }
  return false;
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!isAuthorized(req)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error('send-rescue-welcome-email misconfigured', {
        hasResend: Boolean(resendApiKey),
        hasUrl: Boolean(supabaseUrl),
        hasServiceKey: Boolean(supabaseServiceKey),
      });
      return json({ error: 'Welcome email is not configured' }, 500);
    }

    let body: { user_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const userId = body.user_id?.trim();
    if (
      !userId ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        userId
      )
    ) {
      return json({ error: 'user_id must be a UUID' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Claim idempotency first so concurrent invokes cannot double-send.
    const { data: claimed, error: claimError } = await supabase
      .from('user_profiles')
      .update({ welcome_email_sent: true })
      .eq('id', userId)
      .eq('welcome_email_sent', false)
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('welcome_email_sent claim failed', claimError);
      return json({ error: 'Could not claim welcome email' }, 500);
    }

    if (!claimed) {
      return json({ sent: false, cached: true }, 200);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      console.error('User lookup failed', userError);
      // Roll back claim so a later retry can succeed.
      await supabase
        .from('user_profiles')
        .update({ welcome_email_sent: false })
        .eq('id', userId);
      return json({ error: 'Could not load user' }, 500);
    }

    const displayName =
      (typeof user.user_metadata?.display_name === 'string' &&
        user.user_metadata.display_name) ||
      (typeof user.user_metadata?.full_name === 'string' &&
        user.user_metadata.full_name) ||
      user.email.split('@')[0] ||
      'there';

    const templateData = {
      display_name: displayName,
      shelter_url: `${siteUrl}/shelter`,
      add_pet_url: `${siteUrl}/shelter/pets/new`,
      contact_url: `${siteUrl}/contact`,
      help_email: 'contact@raisedpaws.com',
      site_url: siteUrl,
    };

    const subject = getEmailSubject('rescue_welcome', templateData);
    const html = getEmailHtml('rescue_welcome', templateData);
    const text = getEmailText('rescue_welcome', templateData);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject,
        html,
        text,
      }),
    });

    const resendBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Resend rejected rescue welcome', resendBody);
      await supabase
        .from('user_profiles')
        .update({ welcome_email_sent: false })
        .eq('id', userId);
      return json({ error: 'Could not send welcome email' }, 502);
    }

    return json({
      sent: true,
      id: resendBody.id ?? null,
    });
  } catch (error) {
    console.error('send-rescue-welcome-email exception', error);
    return json({ error: 'Internal error' }, 500);
  }
});
