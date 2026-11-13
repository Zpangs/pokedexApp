// Import each weight from its own path: the package root would bundle all 14 font files
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import { AtkinsonHyperlegibleNext_800ExtraBold } from '@expo-google-fonts/atkinson-hyperlegible-next/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { DatabaseProvider } from '@/db/database-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleNext_800ExtraBold,
  });

  // Keep the native splash screen up until the fonts are ready (or failed; text then falls back)
  if (!fontsLoaded && !fontError) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseProvider>
        <AnimatedSplashOverlay />
        {/* The tabs, with full-screen detail pages pushed on top (system Back returns) */}
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pokemon/[number]" />
          <Stack.Screen name="dex-picker" />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
