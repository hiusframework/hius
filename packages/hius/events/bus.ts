export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventBus {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  // Awaits every handler for `event` — a caller that needs to know
  // dispatch actually completed (the outbox relay does) can await this;
  // a handler that throws rejects emit(), which is what tells the relay
  // not to mark that row dispatched.
  emit(event: string, payload: unknown): Promise<void>;
}

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<EventHandler>>();

  function on(event: string, handler: EventHandler): void {
    let handlers = listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  function off(event: string, handler: EventHandler): void {
    listeners.get(event)?.delete(handler);
  }

  async function emit(event: string, payload: unknown): Promise<void> {
    const handlers = listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    await Promise.all([...handlers].map((handler) => handler(payload)));
  }

  return { on, off, emit };
}
