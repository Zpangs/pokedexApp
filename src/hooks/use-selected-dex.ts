import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { NATIONAL_DEX_ID } from '@/db/queries/pokedexes';

const KEY = 'selected-pokedex';
const listeners = new Set<() => void>();

function read() {
  try {
    const id = Number(Storage.getItemSync(KEY));
    return Number.isInteger(id) && id > 0 ? id : NATIONAL_DEX_ID;
  } catch {
    return NATIONAL_DEX_ID;
  }
}

let current = read();

/** Switches the Dex tab to another Pokédex; remembered across launches. */
export function selectDex(id: number) {
  current = id;
  try {
    Storage.setItemSync(KEY, String(id));
  } catch {
    // Not remembered next launch, but this session still switches
  }
  listeners.forEach((l) => l());
}

/** The Pokédex the Dex tab shows (`pokedexes.id`). */
export function useSelectedDex() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
}
