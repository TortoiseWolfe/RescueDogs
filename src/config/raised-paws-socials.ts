import type { SocialPlatform } from '@/types/author';

/**
 * Canonical Raised Paws profile URLs for the site footer (#118).
 * Keep URLs here — do not scatter them across JSX.
 */
export interface RaisedPawsSocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
}

export const RAISED_PAWS_SOCIALS: readonly RaisedPawsSocialLink[] = [
  {
    platform: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61591768934837',
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/raised-paws/',
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@RaisedPaws',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/raised_paws/',
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@raisedpaws',
  },
  {
    platform: 'twitter',
    label: 'X',
    href: 'https://x.com/Raised_Paws',
  },
] as const;
