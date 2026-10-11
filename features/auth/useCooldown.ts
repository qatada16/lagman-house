import { useCallback, useEffect, useState } from 'react';

export function useCooldown(seconds = 45) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  const start = useCallback((override?: number) => setRemaining(override && override > 0 ? override : seconds), [seconds]);
  return { remaining, start, ready: remaining <= 0 };
}
