import { useCallback, useEffect, useState } from 'react';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { httpEvents } from '../service/httpClient';

/**
 * Estado reactivo de la ApiKey del catálogo: si hay una guardada y cómo
 * persistir una nueva. Se suscribe a `apiKeyUnauthorized` (emitido por
 * `httpClient` ante un 401 con `useApiKey: true`) para reflejar
 * automáticamente cuando el backend la invalida, sin que cada página
 * tenga que escuchar el evento por su cuenta.
 */
export function useApiKey() {
  const [hasApiKey, setHasApiKey] = useState<boolean>(() =>
    Boolean(apiKeyStorage.getApiKey()),
  );

  useEffect(() => {
    const handleUnauthorized = () => setHasApiKey(false);
    httpEvents.addEventListener('apiKeyUnauthorized', handleUnauthorized);
    return () => {
      httpEvents.removeEventListener('apiKeyUnauthorized', handleUnauthorized);
    };
  }, []);

  const saveApiKey = useCallback((key: string) => {
    apiKeyStorage.setApiKey(key);
    setHasApiKey(true);
  }, []);

  return { hasApiKey, saveApiKey };
}
