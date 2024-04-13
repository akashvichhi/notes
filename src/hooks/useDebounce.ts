// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebounce<T extends any[]>(
  callback: (...args: T) => void,
  delay: number = 1000,
): (...args: T) => void {
  let timer: NodeJS.Timeout | null = null;

  return function (...args: T) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

export default useDebounce;
