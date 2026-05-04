export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 500,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempts <= 1) throw err;
    console.warn(`Retrying after error (${attempts - 1} attempts left):`, err);
    await new Promise((res) => setTimeout(res, delayMs));
    return withRetry(fn, attempts - 1, delayMs);
  }
}
