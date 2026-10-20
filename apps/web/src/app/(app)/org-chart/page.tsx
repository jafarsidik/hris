import { OrgChartNew } from '@/features/organization';

export const metadata = { title: 'Struktur Organisasi' } as const;

/**
 * The interactive organization hierarchy with pan/zoom, search, and detail drawer.
 *
 * No `<main>` here: `SidebarInset` in the app shell already renders the one main landmark
 * for every page, and a second one would give the document two of them.
 */
export default function OrgChartPage() {
  return <OrgChartNew />;
}
