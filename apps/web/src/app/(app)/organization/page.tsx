import { OrgTreeCard } from '@/features/organization';

export const metadata = { title: 'Organization Structure' } as const;

/** The structural overview: hierarchy plus the reporting line it sits in. */
export default function OrganizationStructurePage() {
  return (
    <main className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization Structure</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company and organizational hierarchy — legal entities, departments and teams with their
          reporter counts.
        </p>
      </div>
      <OrgTreeCard title="Structure by unit" />
    </main>
  );
}
