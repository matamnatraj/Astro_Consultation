import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Load data with loading/error state; reloads whenever the screen regains focus. */
export function useAsync(fn, deps = [], { refocus = true } = {}) {
  const [state, setState] = useState({ loading: true, data: null, error: null, refreshing: false });
  const mounted = useRef(true);
  const first = useRef(true);
  const run = useCallback(async (mode = 'load') => {
    setState((s) => ({ ...s, loading: mode === 'load' && !s.data, refreshing: mode === 'refresh', error: null }));
    try {
      const data = await fn();
      if (mounted.current) setState({ loading: false, refreshing: false, data, error: null });
    } catch (error) {
      if (mounted.current) setState((s) => ({ ...s, loading: false, refreshing: false, error }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mounted.current = true; run(); return () => { mounted.current = false; }; }, [run]);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    if (refocus) run('silent');
  }, [run, refocus]));
  return {
    ...state,
    reload: () => run('silent'),
    refresh: () => run('refresh'),
    setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })),
  };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
