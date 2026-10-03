import { StatusBar } from 'expo-status-bar';

import { PlatformStatusScreen } from '@/screens/platform-status-screen';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <PlatformStatusScreen />
    </>
  );
}
