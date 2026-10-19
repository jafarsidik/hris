import { OrgChartNew } from '@/features/organization';

export const metadata = { title: 'Struktur Organisasi' } as const;

/** The interactive organization hierarchy with pan/zoom, search, and detail drawer. */
export default function OrgChartPage() {
  return (
    <main>
      <OrgChartNew />
    </main>
  );
}
