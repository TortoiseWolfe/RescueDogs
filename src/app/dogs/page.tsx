import type { Metadata } from 'next';
import SpeciesBrowseView from '@/app/_browse/SpeciesBrowseView';

export const metadata: Metadata = {
  title: 'Browse dogs - Raised Paws',
  description:
    'Browse dogs available for adoption on Raised Paws. Species listings grow as shelter partners join.',
};

export default function BrowseDogsPage() {
  return <SpeciesBrowseView species="dogs" />;
}
