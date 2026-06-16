import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export interface RequestLogContext {
  requestId?: string;
  method?: string;
  path?: string;
  userId?: string;
  userEmail?: string;
}

const storage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(
  context: RequestLogContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestLogContext {
  return storage.getStore() ?? {};
}

export function mergeRequestContext(patch: Partial<RequestLogContext>): void {
  const store = storage.getStore();
  if (!store) return;
  Object.assign(store, patch);
}

export function createRequestId(): string {
  return randomUUID();
}
