import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password - RescueDogs',
  description: 'Set a new password for your RescueDogs account',
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
