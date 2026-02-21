import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { NetworkStatus } from '../types/common';

const HEALTH_CHECK_INTERVAL = 30000;
const HEALTH_CHECK_TIMEOUT = 5000;

const CODEX_HEALTH_URL = (process.env.REACT_APP_CODEX_API_URL || 'http://localhost:4001/api/v1')
  .replace(/\/api\/v1$/, '') + '/health';
const CONTINUUM_HEALTH_URL = (process.env.REACT_APP_CONTINUUM_API_URL || 'http://localhost:4003/api/v1')
  .replace(/\/api\/v1$/, '') + '/health';

export function useHealthCheck(
  setNetworkStatus: (status: NetworkStatus) => void
): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStatusRef = useRef<NetworkStatus>('online');
  const mountedRef = useRef(true);

  const checkHealth = useCallback(async () => {
    if (!navigator.onLine) {
      if (lastStatusRef.current !== 'offline') {
        lastStatusRef.current = 'offline';
        setNetworkStatus('offline');
      }
      return;
    }

    try {
      const [codexRes, continuumRes] = await Promise.all([
        axios.get(CODEX_HEALTH_URL, { timeout: HEALTH_CHECK_TIMEOUT }),
        axios.get(CONTINUUM_HEALTH_URL, { timeout: HEALTH_CHECK_TIMEOUT }),
      ]);

      const codexOk = codexRes.status === 200;
      const continuumOk = continuumRes.status === 200;
      const newStatus: NetworkStatus = codexOk && continuumOk ? 'online' : 'offline';

      if (lastStatusRef.current !== newStatus) {
        lastStatusRef.current = newStatus;
        setNetworkStatus(newStatus);
      }
    } catch {
      if (lastStatusRef.current !== 'offline') {
        lastStatusRef.current = 'offline';
        setNetworkStatus('offline');
      }
    }
  }, [setNetworkStatus]);

  // Use setTimeout chain instead of setInterval to prevent overlapping checks
  // and avoid browser "setInterval handler took Xms" violations
  const scheduleNext = useCallback(() => {
    timeoutRef.current = setTimeout(async () => {
      await checkHealth();
      if (mountedRef.current) {
        scheduleNext();
      }
    }, HEALTH_CHECK_INTERVAL);
  }, [checkHealth]);

  useEffect(() => {
    mountedRef.current = true;

    // Initial check, then start the chain
    checkHealth().then(() => {
      if (mountedRef.current) {
        scheduleNext();
      }
    });

    const handleOnline = () => {
      checkHealth();
    };

    const handleOffline = () => {
      lastStatusRef.current = 'offline';
      setNetworkStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth, scheduleNext, setNetworkStatus]);
}
