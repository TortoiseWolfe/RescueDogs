import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication - Held Paws',
  description: 'Processing authentication',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
