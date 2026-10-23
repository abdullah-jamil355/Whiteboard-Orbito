export type NumberStore = Readonly<{ subscribe: (listener: () => void) => () => void; getSnapshot: () => number; set: (value: number) => void }>;
export type HistoryBusySnapshot = Readonly<{ sessionId: string | null; busy: boolean }>;
export type HistoryBusyStore = Readonly<{ subscribe: (listener: () => void) => () => void; getSnapshot: () => HistoryBusySnapshot; set: (value: HistoryBusySnapshot) => void }>;
export const inactiveHistoryBusy: HistoryBusySnapshot = Object.freeze({ sessionId: null, busy: false });

export const createNumberStore = (): NumberStore => {
  let value = 0;
  const listeners = new Set<() => void>();
  return Object.freeze({
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => value,
    set: (next: number) => { if (next === value) return; value = next; for (const listener of listeners) listener(); }
  });
};

export const createHistoryBusyStore = (): HistoryBusyStore => {
  let value: HistoryBusySnapshot = { sessionId: null, busy: false };
  const listeners = new Set<() => void>();
  return Object.freeze({
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => value,
    set: (next: HistoryBusySnapshot) => {
      if (value.sessionId === next.sessionId && value.busy === next.busy) return;
      value = next;
      for (const listener of listeners) listener();
    }
  });
};
