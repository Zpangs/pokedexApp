import { SQLiteProvider } from 'expo-sqlite';
import type { ReactNode } from 'react';

import { DB_VERSION } from './version';

/**
 * Opens the Pokédex database bundled with the app (built by `npm run build-db`).
 *
 * On first launch, expo-sqlite copies the bundled file into the app's storage. The copy is named
 * after the data version, so a rebuilt database gets a fresh copy instead of the stale one.
 * Use `useSQLiteContext()` from expo-sqlite inside this provider to run queries.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider
      databaseName={`pokedex-${DB_VERSION}.db`}
      assetSource={{ assetId: require('@/assets/db/pokedex.db') }}>
      {children}
    </SQLiteProvider>
  );
}
