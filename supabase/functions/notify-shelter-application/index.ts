/**
 * Notify shelter staff when a new adoption application is submitted (#260).
 *
 * Invoked by pg_net from queue_shelter_application_notify() (DB trigger) or
 * manually with service-role auth. Idempotent per application_id.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getEmailSubject,
  getEmailHtml,
  getEmailText,
} from '../_shared/email-templates.ts';
import {
  checkIdempotencyKey,
  recordIdempotencyKey,
} from '../_shared/idempotency.ts';

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const webhookSecret = Deno.env.get('APPLICATION_NOTIFY_WEBHOOK_SECRET');
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

interface ProfileSnapshot {
  full_name?: string;
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!isAuthorized(req)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: { application_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const applicationId = body.application_id?.trim();
    if (
      !applicationId ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        applicationId
      )
    ) {
      return json({ error: 'application_id must be a UUID' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const idempotencyKey = `shelter-app-notify-${applicationId}`;

    const cached = await checkIdempotencyKey(
      supabase,
      idempotencyKey,
      'notify-shelter-application'
    );
    if (cached.cached) {
      return json({ sent: false, cached: true, ...cached.result }, 200);
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, profile_snapshot, pets(name), shelters(name, contact_email)')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      console.error('Application lookup failed:', appError);
      return json({ error: 'Could not load application' }, 500);
    }

    if (!application) {
      return json({ error: 'Application not found' }, 404);
    }

    const petEmbed = application.pets as { name?: string } | null;
    const shelterEmbed = application.shelters as {
      name?: string;
      contact_email?: string | null;
    } | null;

    const recipient = shelterEmbed?.contact_email?.trim().toLowerCase();
    if (!recipient) {
      const result = { sent: false, skipped: true, reason: 'no_contact_email' };
      await recordIdempotencyKey(
        supabase,
        idempotencyKey,
        'notify-shelter-application',
        result
      );
      return json(result, 200);
    }

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return json({ error: 'Email provider not configured' }, 503);
    }

    const snapshot = (application.profile_snapshot ?? {}) as ProfileSnapshot;
    const applicantName =
      typeof snapshot.full_name === 'string' && snapshot.full_name.trim() !== ''
        ? snapshot.full_name.trim()
        : 'An applicant';

    const emailData = {
      pet_name: petEmbed?.name ?? 'a pet',
      shelter_name: shelterEmbed?.name ?? 'your rescue',
      applicant_name: applicantName,
      application_url: `${siteUrl}/shelter/application?id=${applicationId}`,
    };

    const subject = getEmailSubject('shelter_new_application', emailData);
    const html = getEmailHtml('shelter_new_application', emailData);
    const text = getEmailText('shelter_new_application', emailData);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html,
        text,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return json({ error: 'Failed to send email', details: resendData }, 500);
    }

    const result = {
      sent: true,
      email_id: resendData.id,
      recipient,
    };
    await recordIdempotencyKey(
      supabase,
      idempotencyKey,
      'notify-shelter-application',
      result
    );

    return json(result, 200);
  } catch (error) {
    console.error('notify-shelter-application error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      500
    );
  }
});
