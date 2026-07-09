import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conversations - Raised Paws',
  description: 'Your conversations',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
