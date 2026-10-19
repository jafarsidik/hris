import type { Metadata } from 'next';

import { MessagingChannelsScreen } from '@/features/platform/messaging-channels-screen';

export const metadata: Metadata = { title: 'Messaging Channels' };

export default function MessagingChannelsPage() {
  return <MessagingChannelsScreen />;
}
