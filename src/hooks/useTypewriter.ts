import { useRef, useCallback } from "react";

export function useTypewriter() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const type = useCallback(
    (
      text: string,
      onUpdate: (currentText: string) => void,
      totalDurationMs: number,
    ): Promise<void> => {
      return new Promise((resolve) => {
        cancel();
        cancelledRef.current = false;

        const words = text.split(" ");

        // fallback if duration unavailable
        const msPerWord = totalDurationMs
          ? totalDurationMs / words.length
          : 120;

        let index = 0;
        let current = "";

        function typeNext() {
          if (cancelledRef.current) return;

          if (index >= words.length) {
            resolve();
            return;
          }

          const word = words[index];
          const isLast = index === words.length - 1;

          current = current ? current + " " + word : word;

          onUpdate(current);

          index++;

          const jitter = (Math.random() - 0.5) * 20;

          const punctuationPause =
            word.endsWith(".") || word.endsWith("?") || word.endsWith("!")
              ? 80
              : 0;

          timeoutRef.current = setTimeout(
            typeNext,
            isLast ? 0 : Math.max(20, msPerWord + jitter + punctuationPause),
          );
        }

        typeNext();
      });
    },
    [cancel],
  );

  return { type, cancel };
}
