import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started - Raised Paws',
  description:
    'Choose adopter application tracking or the shelter pipeline before you sign in',
};

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
