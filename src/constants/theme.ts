/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** The sign system: red-to-blue gradient bands and black sign panels. */
const Sign = {
  /** Solid accent where a gradient can't go (tab indicator, selected chips). */
  sign: '#C8102E',
  /** Text and icons on the gradient band and on `sign`. */
  onSign: '#FFFFFF',
  /** Black field set into the yellow band (the search field). */
  field: '#0B0B0B',
  onPanel: '#FFFFFF',
  /** Panel sign titles; a light red that stays readable on black. */
  onPanelAccent: '#FF7A85',
  onPanelSecondary: '#A3A3A3',
} as const;

/** The band gradient, left (red) to right (blue). White text holds AA across it. */
export const SignGradient = ['#C8102E', '#1D4ED8'] as const;

export const Colors = {
  light: {
    ...Sign,
    /** Panel signs (generation gates, section signs, navigation bar). */
    panel: '#0B0B0B',
    text: '#0B0B0B',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F0',
    backgroundSelected: '#E6E6E6',
    textSecondary: '#5C5C5C',
    rule: '#E6E6E6',
    /** The line between Dex rows. */
    rowRule: '#A8A8A8',
    /** Stat bars, and the highest stat's bar. */
    bar: '#8A8A8A',
    barHighlight: '#0B0B0B',
  },
  dark: {
    ...Sign,
    // The sign's panel frame tone, so panels keep an edge against the black ground
    panel: '#1A1A1A',
    text: '#FFFFFF',
    background: '#0B0B0B',
    backgroundElement: '#1A1A1A',
    backgroundSelected: '#262626',
    textSecondary: '#A3A3A3',
    rule: '#262626',
    rowRule: '#4D4D4D',
    bar: '#8A8A8A',
    barHighlight: '#FF7A85',
  },
} as const;

/** Atkinson Hyperlegible Next, loaded in the root layout. On Android each weight is its own family. */
export const Font = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  extraBold: 'AtkinsonHyperlegibleNext_800ExtraBold',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** The floating menu button's size, and the space lists leave below their last row to clear it. */
export const MenuButtonSize = 56;
export const MenuButtonInset = MenuButtonSize + Spacing.three * 2;
export const MaxContentWidth = 800;
