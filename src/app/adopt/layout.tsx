import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply to adopt - Raised Paws',
  description:
    'Submit your pet adoption application and track status live with Raised Paws.',
};

export default function AdoptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
