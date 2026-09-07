import { useRef } from 'react';
import * as store from './localStore';
import { captureAccountSession } from './accountSession';

// Bind delayed callbacks (dialogs, timers, uploads) to their originating workspace.
// AuthProvider remounts this subtree on every ownership-generation change.
export function useAccountStore() {
  const bound = useRef(null);
  if (!bound.current) {
    const scope = captureAccountSession();
    bound.current = Object.fromEntries(Object.entries(store).map(([name, fn]) => [name,
      (...args) => fn(...args, scope)]));
  }
  return bound.current;
}
