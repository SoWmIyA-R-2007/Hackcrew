import { useEffect, useState } from 'react';

/**
 * True once `ms` have passed. Loading states wait a moment before showing, so fast pages never flash a
 * skeleton and only real lag gets one
 */
export function useDelayed(ms = 200) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return shown;
}
