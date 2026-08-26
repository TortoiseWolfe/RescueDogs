export interface ShelterNewApplicationEmailData {
  pet_name: string;
  shelter_name: string;
  applicant_name: string;
  application_url: string;
}

export type EmailTemplateData =
  | Record<string, unknown>
  | ShelterNewApplicationEmailData;

export function getEmailSubject(
  type: string,
  data?: EmailTemplateData
): string {
  if (type === 'shelter_new_application') {
    const d = data as ShelterNewApplicationEmailData;
    return `New adoption application for ${d.pet_name} — ${d.shelter_name}`;
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

  return `Payment Notification - Type: ${type}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
