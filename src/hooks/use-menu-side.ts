import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/** Which edge the menu and its button sit on, for the thumb of the hand holding the phone. */
export type MenuSide = 'left' | 'right';

const KEY = 'menu-side';
const listeners = new Set<() => void>();

function read(): MenuSide {
  try {
    return Storage.getItemSync(KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

let current = read();

/** Moves the menu to the other side; remembered across launches. */
export function setMenuSide(side: MenuSide) {
  current = side;
  try {
    Storage.setItemSync(KEY, side);
  } catch {
    // Not remembered next launch, but this session still switches
  }
  listeners.forEach((l) => l());
}

export function useMenuSide() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
}
