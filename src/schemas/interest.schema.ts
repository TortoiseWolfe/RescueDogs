import { z } from 'zod';
import {
  CONTACT_ROLES,
  type ContactFormData,
  type ContactRole,
  CONTACT_ROLE_LABELS,
} from '@/schemas/contact.schema';

/**
 * Early interest list (#129) — email capture for static hosting via the
 * existing Web3Forms / EmailJS stack (same NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY
 * as Contact). Not a newsletter; stores nothing in Supabase for v1.
 */
export const INTEREST_ROLES = CONTACT_ROLES;
export type InterestRole = ContactRole;

export const INTEREST_ROLE_LABELS: Record<InterestRole, string> = {
  shelter: CONTACT_ROLE_LABELS.shelter,
  adopter: CONTACT_ROLE_LABELS.adopter,
  other: CONTACT_ROLE_LABELS.other,
};

export const interestSchema = z.object({
  email: z
    .string()
    .transform((str) => str.toLowerCase().trim())
    .pipe(
      z
        .string()
        .email('Please enter a valid email address')
        .max(254, 'Email address is too long')
    ),

  name: z
    .string()
    .transform((str) => str.trim())
    .pipe(
      z
        .string()
        .max(100, 'Name must be less than 100 characters')
        .regex(/^$|^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters')
    )
    .optional(),

  role: z.enum(INTEREST_ROLES, {
    message: 'Please tell us who you are',
  }),

  _gotcha: z.string().max(0, 'Bot detected').optional(),
});

export type InterestFormData = z.infer<typeof interestSchema>;

/** Map interest signup → contact email payload for useWeb3Forms. */
export function interestToContactPayload(
  data: InterestFormData
): ContactFormData {
  const displayName =
    data.name && data.name.length >= 2 ? data.name : 'Early interest';
  const roleLabel = INTEREST_ROLE_LABELS[data.role];

  return {
    name: displayName,
    email: data.email,
    role: data.role,
    subject: 'Early interest list signup',
    message: [
      'Someone joined the Raised Paws early interest list.',
      '',
      `Email: ${data.email}`,
      `Who: ${roleLabel}`,
      data.name ? `Name: ${data.name}` : null,
      '',
      'Promise on the page: occasional updates when there is something real for shelters or adopters — not a newsletter blast.',
    ]
      .filter(Boolean)
      .join('\n'),
    _gotcha: data._gotcha ?? '',
  };
}
