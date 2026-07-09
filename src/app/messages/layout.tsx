import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages - Raised Paws',
  description: 'Your private messages',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
