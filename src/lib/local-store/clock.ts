/** Time as the pull loop sees it, so a page timeout is exercised in Jest without waiting. */
export type StoreClock = {
  now(): number;
  setTimeout(run: () => void, ms: number): () => void;
};

export const systemClock: StoreClock = {
  now: () => Date.now(),
  setTimeout: (run, ms) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  },
};
