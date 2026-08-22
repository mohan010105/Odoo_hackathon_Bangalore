import { useCallback, useRef, useState } from "react";

/**
 * Retry-safe export runner.
 *
 * Every export task gets a stable idempotency key that is reused while the
 * export keeps failing, so a retry is recorded once instead of twice, and is
 * rotated after a successful download so the next deliberate export is a new
 * one. Clicks that arrive while a task is already running are ignored, which
 * makes double-clicking harmless.
 */
export function useIdempotentExport<TaskId extends string>() {
  const inFlight = useRef(new Set<TaskId>());
  const keys = useRef(new Map<TaskId, string>());
  const [running, setRunning] = useState<TaskId | null>(null);

  const newKey = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const run = useCallback(
    async (taskId: TaskId, task: (idempotencyKey: string) => Promise<void>) => {
      if (inFlight.current.size > 0) return;

      const key = keys.current.get(taskId) ?? `${taskId}-${newKey()}`;
      keys.current.set(taskId, key);
      inFlight.current.add(taskId);
      setRunning(taskId);

      try {
        await task(key);
        // Succeeded: the next export of this kind is a new logical export.
        keys.current.delete(taskId);
      } finally {
        inFlight.current.delete(taskId);
        setRunning(null);
      }
    },
    [],
  );

  return { run, running, busy: running !== null };
}
