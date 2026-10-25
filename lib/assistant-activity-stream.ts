import { encodeActivityEvent, type AssistantActivity } from "./assistant-activity-shared";

/** Full snapshots on reconnect recover missed events without a lossy event cursor. */
export function activityStream(
  read: () => Promise<AssistantActivity[]>,
  signal: AbortSignal,
  options: { pollMs?: number; lifetimeMs?: number } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let stop = (_close = true) => {};
  return new ReadableStream({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let lastPayload = "";
      let lastSent = 0;
      const deadline = Date.now() + (options.lifetimeMs ?? 55_000);
      const lifetime = setTimeout(() => stop(), options.lifetimeMs ?? 55_000);
      stop = (close = true) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        clearTimeout(lifetime);
        signal.removeEventListener("abort", abort);
        if (close) controller.close();
      };
      const abort = () => stop();
      const send = (value: string) => {
        // Bound the queue if a client stops consuming the stream.
        if (closed) return;
        if ((controller.desiredSize ?? 0) <= 0) { stop(); return; }
        controller.enqueue(encoder.encode(value));
        lastSent = Date.now();
      };
      const tick = async () => {
        if (closed) return;
        if (Date.now() >= deadline) { stop(); return; }
        try {
          const payload = encodeActivityEvent(await read());
          if (closed) return;
          if (payload !== lastPayload) { send(payload); lastPayload = payload; }
          else if (Date.now() - lastSent >= 15_000) send(": heartbeat\n\n");
        } catch {
          send('event: unavailable\ndata: {}\n\n');
          stop();
          return;
        }
        if (!closed) timer = setTimeout(() => void tick(), options.pollMs ?? 2000);
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { stop(); return; }
      send("retry: 3000\n\n");
      void tick();
    },
    cancel() { stop(false); },
  }, { highWaterMark: 8 });
}
