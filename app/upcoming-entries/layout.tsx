import type { ReactNode } from 'react';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Upcoming Tournament Entries',
  description: 'Look up published badminton tournament entries for the coming six weeks.',
};
export default function EntriesLayout({ children }: { children: ReactNode }) { return children; }
