import { useState, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({ data: null, isLoading: false, error: null });

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const result = await apiCall();
      setState({ data: result, isLoading: false, error: null });
      return result;
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'An error occurred';
      setState({ data: null, isLoading: false, error: message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
