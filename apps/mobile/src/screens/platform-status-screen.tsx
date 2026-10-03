import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL, MAX_CAPTURE_CLOCK_SKEW_MS } from '@/lib/api/config';
import { fetchPlatformLiveness, MobileApiError, type PlatformLiveness } from '@/lib/api/platform';

type Status =
  | { readonly kind: 'loading' }
  | { readonly kind: 'online'; readonly liveness: PlatformLiveness }
  | { readonly kind: 'offline'; readonly message: string; readonly correlationId?: string };

export function PlatformStatusScreen() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const check = useCallback(async (signal?: AbortSignal) => {
    setStatus({ kind: 'loading' });
    try {
      const liveness = await fetchPlatformLiveness(signal);
      setStatus({ kind: 'online', liveness });
    } catch (error: unknown) {
      setStatus({
        kind: 'offline',
        message:
          error instanceof MobileApiError
            ? error.message
            : 'The HRIS service could not be reached.',
        ...(error instanceof MobileApiError && error.correlationId
          ? { correlationId: error.correlationId }
          : {}),
      });
    } finally {
      setRefreshedAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        HRIS
      </Text>
      <Text style={styles.subtitle}>Mobile platform foundation</Text>

      <View style={styles.card} accessibilityLiveRegion="polite">
        {status.kind === 'loading' ? (
          <View style={styles.row}>
            <ActivityIndicator accessibilityLabel="Checking service status" />
            <Text style={styles.bodyText}>Checking service status…</Text>
          </View>
        ) : null}

        {status.kind === 'online' ? (
          <View>
            <Text style={styles.heading}>Connected</Text>
            <Text style={styles.bodyText}>
              {status.liveness.service} is responding from the {status.liveness.environment}{' '}
              environment.
            </Text>
            <Text style={styles.caption}>Uptime {Math.round(status.liveness.uptimeSeconds)}s</Text>
          </View>
        ) : null}

        {status.kind === 'offline' ? (
          <View>
            <Text style={styles.heading}>Working offline</Text>
            <Text style={styles.bodyText}>{status.message}</Text>
            {status.correlationId ? (
              <Text style={styles.caption}>Reference {status.correlationId}</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => void check()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Check again</Text>
        </Pressable>

        {refreshedAt ? <Text style={styles.caption}>Updated {refreshedAt}</Text> : null}
      </View>

      <Text style={styles.caption}>API {API_BASE_URL}</Text>
      <Text style={styles.caption}>
        Captures more than {Math.round(MAX_CAPTURE_CLOCK_SKEW_MS / 60000)} minutes from the device
        clock are flagged for review by the server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 8,
    backgroundColor: '#f1f5f9',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  bodyText: {
    fontSize: 15,
    color: '#334155',
  },
  caption: {
    fontSize: 12,
    color: '#64748b',
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: '#1e40af',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
