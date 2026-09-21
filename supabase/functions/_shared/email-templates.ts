export interface ShelterNewApplicationEmailData {
  pet_name: string;
  shelter_name: string;
  applicant_name: string;
  application_url: string;
}

export interface RescueWelcomeEmailData {
  display_name: string;
  shelter_url: string;
  add_pet_url: string;
  contact_url: string;
  help_email: string;
  site_url: string;
}

export type EmailTemplateData =
  | Record<string, unknown>
  | ShelterNewApplicationEmailData
  | RescueWelcomeEmailData;

export function getEmailSubject(
  type: string,
  data?: EmailTemplateData
): string {
  if (type === 'shelter_new_application') {
    const d = data as ShelterNewApplicationEmailData;
    return `New adoption application for ${d.pet_name} — ${d.shelter_name}`;
  }

  if (type === 'rescue_welcome') {
    return 'Welcome to Raised Paws — next steps for your rescue';
  }

  const subjects: Record<string, string> = {
    payment_success: 'Payment Successful',
    payment_failure: 'Payment Failed',
    subscription_created: 'Subscription Activated',
  };
  return subjects[type] || 'Payment Notification';
}

export function getEmailHtml(type: string, data: EmailTemplateData): string {
  if (type === 'shelter_new_application') {
    const d = data as ShelterNewApplicationEmailData;
    return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0c1929;">
  <h2 style="margin-bottom: 0.5rem;">New adoption application</h2>
  <p><strong>${escapeHtml(d.applicant_name)}</strong> applied to adopt <strong>${escapeHtml(d.pet_name)}</strong>.</p>
  <p>Open the application in your shelter dashboard:</p>
  <p><a href="${escapeHtml(d.application_url)}">${escapeHtml(d.application_url)}</a></p>
  <p style="color: #64748b; font-size: 0.875rem;">${escapeHtml(d.shelter_name)} · Raised Paws adoption portal</p>
</body>
</html>`;
  }

  if (type === 'rescue_welcome') {
    const d = data as RescueWelcomeEmailData;
    return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0c1929; max-width: 36rem;">
  <h2 style="margin-bottom: 0.5rem;">Welcome to Raised Paws</h2>
  <p>Hi ${escapeHtml(d.display_name)},</p>
  <p>Your account is active. Here’s how to get your rescue set up:</p>
  <ol>
    <li><strong>Complete your rescue profile</strong> — open the shelter portal and create or finish your organization details:<br/>
      <a href="${escapeHtml(d.shelter_url)}">${escapeHtml(d.shelter_url)}</a></li>
    <li><strong>Add your first pet</strong> — photos, story, and listing details:<br/>
      <a href="${escapeHtml(d.add_pet_url)}">${escapeHtml(d.add_pet_url)}</a></li>
    <li><strong>How adoption works here</strong> — adopters apply from the pet page, and you update status in the shelter dashboard so they can track progress (no more endless “any update?” email threads).</li>
  </ol>
  <p><strong>Need help?</strong> Use the contact form at
    <a href="${escapeHtml(d.contact_url)}">${escapeHtml(d.contact_url)}</a>
    or email <a href="mailto:${escapeHtml(d.help_email)}">${escapeHtml(d.help_email)}</a>.</p>
  <p style="color: #64748b; font-size: 0.875rem;">Raised Paws · <a href="${escapeHtml(d.site_url)}">${escapeHtml(d.site_url)}</a></p>
</body>
</html>`;
  }

  return `<html><body><h2>Payment Notification</h2><p>Type: ${escapeHtml(type)}</p></body></html>`;
}

export function getEmailText(type: string, data: EmailTemplateData): string {
  if (type === 'shelter_new_application') {
    const d = data as ShelterNewApplicationEmailData;
    return [
      'New adoption application',
      '',
      `${d.applicant_name} applied to adopt ${d.pet_name}.`,
      '',
      `Review the application: ${d.application_url}`,
      '',
      `${d.shelter_name} · Raised Paws adoption portal`,
    ].join('\n');
  }

  if (type === 'rescue_welcome') {
    const d = data as RescueWelcomeEmailData;
    return [
      'Welcome to Raised Paws',
      '',
      `Hi ${d.display_name},`,
      '',
      'Your account is active. Here’s how to get your rescue set up:',
      '',
      `1. Complete your rescue profile: ${d.shelter_url}`,
      `2. Add your first pet: ${d.add_pet_url}`,
      '3. How adoption works: adopters apply from the pet page; you update status in the shelter dashboard so they can track progress.',
      '',
      `Need help? ${d.contact_url} or ${d.help_email}`,
      '',
      `Raised Paws · ${d.site_url}`,
    ].join('\n');
  }

  return `Payment Notification - Type: ${type}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
