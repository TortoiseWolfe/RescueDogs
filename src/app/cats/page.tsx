import type { Metadata } from 'next';
import SpeciesBrowseView from '@/app/_browse/SpeciesBrowseView';

export const metadata: Metadata = {
  title: 'Browse cats - Raised Paws',
  description:
    'Browse cats available for adoption on Raised Paws. Species listings grow as shelter partners join.',
};

export default function BrowseCatsPage() {
  return <SpeciesBrowseView species="cats" />;
}
