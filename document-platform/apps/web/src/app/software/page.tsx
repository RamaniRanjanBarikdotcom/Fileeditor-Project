import type { Metadata } from 'next';
import { SoftwareCatalog } from '../../components/SoftwareCatalog';

export const metadata: Metadata = {
  title: 'Software Store — AppToolkitLab',
  description: 'Browse AppToolkitLab software and developer products using live catalog and pricing data.',
};

export default function SoftwareMarketplacePage() {
  return <SoftwareCatalog />;
}
