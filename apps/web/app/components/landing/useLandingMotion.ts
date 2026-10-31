import { useEffect, useState } from 'react';
export function useLandingMotion() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(preference.matches);
      setReady(true);
    };
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  return { ready, reduced, paused, enabled: ready && !reduced && !paused, toggle: () => setPaused((value) => !value) };
}
