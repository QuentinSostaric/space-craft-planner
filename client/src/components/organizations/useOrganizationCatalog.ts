import { useCallback, useEffect, useState } from 'react';
import { AuthApiError, type OrganizationSharedBlueprintPayload, type OrganizationSharedResourcePayload } from '../../services/authService';

export interface OrganizationCatalogResult<T> { loading: boolean; data: T | null; error: string | null }
const initial = { loading: true, data: null, error: null };

function useCatalogEndpoint<T>(sid: string, fetcher: (sid: string) => Promise<T>, emptyMessage: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<OrganizationCatalogResult<T>>(initial);
  const reload = useCallback(() => setRevision(current => current + 1), []);
  useEffect(() => {
    let cancelled = false;
    setResult(initial);
    void fetcher(sid).then(data => {
      if (!cancelled) setResult({ loading: false, data, error: null });
    }).catch(error => {
      if (cancelled) return;
      const empty = error instanceof AuthApiError && error.status === 404 && error.message.toLowerCase().includes(emptyMessage);
      setResult({ loading: false, data: null, error: empty ? null : error instanceof Error ? error.message : 'Unable to load shared offers.' });
    });
    return () => { cancelled = true; };
  }, [sid, fetcher, emptyMessage, revision]);
  return { ...result, reload };
}

export function useOrganizationCatalog({ sid, loadBlueprints, loadResources }: {
  sid: string;
  loadBlueprints: (sid: string) => Promise<OrganizationSharedBlueprintPayload>;
  loadResources: (sid: string) => Promise<OrganizationSharedResourcePayload>;
}) {
  // Each catalog settles and retries independently. A failed blueprint
  // response must not hide successfully loaded resources or contributors.
  const blueprints = useCatalogEndpoint(sid, loadBlueprints, 'no shared blueprints');
  const resources = useCatalogEndpoint(sid, loadResources, 'no shared resources');
  const reload = useCallback(() => { blueprints.reload(); resources.reload(); }, [blueprints.reload, resources.reload]);
  return { blueprints, resources, reload };
}
