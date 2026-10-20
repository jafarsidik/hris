import { LocationsScreen } from '@/features/organization/locations-screen';

export const metadata = { title: 'Locations' } as const;

/**
 * Locations route.
 *
 * Reads and writes work locations through the API, replacing the fixed list that used to
 * back this screen.
 */
export default function LocationListPage() {
  return <LocationsScreen />;
}
