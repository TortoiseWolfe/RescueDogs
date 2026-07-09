import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - Raised Paws',
  description: 'Create a new Raised Paws account',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
