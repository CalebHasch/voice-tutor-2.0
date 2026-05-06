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
      wordsPerMinute = 160,
    ): Promise<void> => {
      return new Promise((resolve) => {
        cancel();
        cancelledRef.current = false;

        const words = text.split(" ");
        const msPerWord = (60 / wordsPerMinute) * 1000;

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

          const jitter = (Math.random() - 0.5) * (msPerWord * 0.3);

          const punctuationPause =
            word.endsWith(".") || word.endsWith("?") || word.endsWith("!")
              ? msPerWord * 1.5
              : 0;

          timeoutRef.current = setTimeout(
            typeNext,
            isLast ? 0 : msPerWord + jitter + punctuationPause,
          );
        }

        typeNext();
      });
    },
    [cancel],
  );

  return { type, cancel };
}
