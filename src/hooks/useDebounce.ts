import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebounce<T extends any[]>(
  callback: (...args: T) => void,
  delay: number,
): (...args: T) => void {
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: T) => {
      if (timer) {
        clearTimeout(timer);
      }

      const newTimer = setTimeout(() => {
        callback(...args);
      }, delay);

      setTimer(newTimer);
    },
    [callback, delay, timer],
  );

  useEffect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timer]);

  return debouncedCallback;
}

export default useDebounce;
