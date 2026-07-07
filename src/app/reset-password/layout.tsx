import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password - Held Paws',
  description: 'Set a new password for your Held Paws account',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
