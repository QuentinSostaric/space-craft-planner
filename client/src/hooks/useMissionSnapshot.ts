import { useEffect, useState } from 'react';

// Research snapshots are immutable and explicitly tied to their source build.
// They do not replace the selected public dataset or its blueprint catalog.
export const MISSION_REFERENCE_BUILD = '12519617';
const snapshots = new Map<string, unknown>();

export function useMissionSnapshot<T>(kind: 'intelligence' | 'operations') {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false });
  useEffect(() => {
    const controller = new AbortController();
    if (snapshots.has(kind)) {
      setState({ data: snapshots.get(kind) as T, loading: false, error: false });
      return () => controller.abort();
    }
    setState({ data: null, loading: true, error: false });
    void fetch(`${import.meta.env.BASE_URL}data/mission-${kind}-${MISSION_REFERENCE_BUILD}.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Mission snapshot unavailable');
        const data = await response.json();
        if (data.schemaVersion !== 1 || String(data.build?.buildNumber) !== MISSION_REFERENCE_BUILD || data.build?.channel !== 'live'
          || (kind === 'intelligence' ? !Array.isArray(data.tracks) || !Array.isArray(data.missions) : !Array.isArray(data.operations))) {
          throw new Error('Unsupported mission snapshot');
        }
        if (!controller.signal.aborted) {
          snapshots.set(kind, data);
          setState({ data: data as T, loading: false, error: false });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [kind, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
