import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionSign } from '@/components/pokemon/section-sign';
import { OfflinePack } from '@/components/settings/offline-pack';
import { SignBand } from '@/components/sign-band';
import { Font, MenuButtonInset, Spacing } from '@/constants/theme';
import { type MenuSide, setMenuSide, useMenuSide } from '@/hooks/use-menu-side';
import { useTheme } from '@/hooks/use-theme';

const SIDES: { side: MenuSide; label: string; detail: string }[] = [
  { side: 'left', label: 'Left', detail: 'For holding the phone in your left hand' },
  { side: 'right', label: 'Right', detail: 'For holding the phone in your right hand' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const side = useMenuSide();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SignBand style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
        <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
          Settings
        </Text>
      </SignBand>
      <ScrollView contentContainerStyle={{ paddingBottom: MenuButtonInset + Spacing.three }}>
        <SectionSign title="Menu side" />
        <View style={styles.body} accessibilityRole="radiogroup">
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            The menu button and the menu itself sit on this side, within reach of your thumb.
          </Text>
          {SIDES.map((s) => {
            const selected = s.side === side;
            return (
              <Pressable
                key={s.side}
                onPress={() => setMenuSide(s.side)}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: selected ? theme.text : theme.rule },
                  selected && styles.optionSelected,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${s.label}. ${s.detail}`}>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{s.label}</Text>
                  <Text style={[styles.note, { color: theme.textSecondary }]}>{s.detail}</Text>
                </View>
                <SymbolView
                  name={
                    selected
                      ? { ios: 'checkmark.circle.fill', android: 'radio_button_checked', web: 'radio_button_checked' }
                      : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
                  }
                  size={26}
                  tintColor={selected ? theme.text : theme.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>

        <SectionSign title="Offline images" />
        <View style={styles.body}>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Everything else already works offline. Download the pictures too, so they show up
            with no signal. Keep the app open while it downloads.
          </Text>
          <OfflinePack pack="small" />
          <OfflinePack pack="artwork" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  title: {
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  note: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
  },
  // The thicker outline eats into the padding, so the text doesn't shift when picked
  optionSelected: {
    borderWidth: 3,
    padding: Spacing.three - 2,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
});
