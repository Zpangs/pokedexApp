import { createContext, createElement, type ReactNode, useContext, useMemo } from 'react';

import { SignGradient } from '@/constants/theme';
import { dexPalette } from '@/constants/dex-palettes';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedDex } from '@/hooks/use-selected-dex';
import { useTheme } from '@/hooks/use-theme';

const DexScope = createContext(false);

/** Screens inside take their sign colours from the selected Pokédex (the Dex list, Pokémon pages). */
export function DexThemeScope({ children }: { children: ReactNode }) {
  return createElement(DexScope.Provider, { value: true }, children);
}

/**
 * The theme plus the sign gradient. Inside a `DexThemeScope` the sign colours come from the
 * selected Pokédex's games; elsewhere they're the app's own red-to-blue.
 */
export function useSignTheme() {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const scoped = useContext(DexScope);
  const selected = useSelectedDex();

  return useMemo(() => {
    if (!scoped) return { ...theme, gradient: SignGradient as readonly [string, string] };
    const palette = dexPalette(selected);
    return {
      ...theme,
      gradient: palette.gradient,
      sign: palette.gradient[0],
      onPanelAccent: palette.accent,
      barHighlight: dark ? palette.accent : theme.barHighlight,
    };
  }, [theme, dark, scoped, selected]);
}
