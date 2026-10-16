import type { Metadata } from 'next';

import { BackupRestoreScreen } from '@/features/platform/backup-restore-screen';

export const metadata: Metadata = { title: 'Backup & Restore' };

export default function BackupRestorePage() {
  return <BackupRestoreScreen />;
}
