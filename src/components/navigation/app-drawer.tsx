import { Drawer, type DrawerContentComponentProps } from 'expo-router/drawer';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, MenuButtonSize, Spacing } from '@/constants/theme';
import { DexThemeScope, useSignTheme } from '@/hooks/use-dex-theme';
import { useMenuSide } from '@/hooks/use-menu-side';
import { useTheme } from '@/hooks/use-theme';

type Section = { name: string; label: string; icon: SymbolViewProps['name'] };

/** The sections, in menu order. `name` is the route file in src/app/(main). */
const SECTIONS: Section[] = [
  { name: 'index', label: 'Pokédex', icon: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' } },
  { name: 'teams', label: 'Teams', icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' } },
  { name: 'calc', label: 'Damage calc', icon: { ios: 'flame.fill', android: 'calculate', web: 'calculate' } },
  { name: 'moves', label: 'Moves', icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' } },
  { name: 'abilities', label: 'Abilities', icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } },
  { name: 'items', label: 'Items', icon: { ios: 'bag.fill', android: 'backpack', web: 'backpack' } },
  { name: 'types', label: 'Types & Natures', icon: { ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' } },
];

const SETTINGS: Section = {
  name: 'settings',
  label: 'Settings',
  icon: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
};

/**
 * The app's sections in a menu that slides in from the side the player picked in Settings,
 * opened by a round button in that bottom corner so the thumb holding the phone reaches it.
 */
export function AppDrawer() {
  const side = useMenuSide();
  const theme = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <MenuContent {...props} />}
      screenLayout={({ children, navigation, route }) => {
        const button = <MenuButton side={side} onPress={() => navigation.openDrawer()} />;
        return (
          <View style={styles.screen}>
            {children}
            {/* On the Dex tab the button takes the selected Pokédex's colour */}
            {route.name === 'index' ? <DexThemeScope>{button}</DexThemeScope> : button}
          </View>
        );
      }}
      screenOptions={{
        headerShown: false,
        drawerPosition: side,
        drawerType: 'front',
        drawerStyle: { backgroundColor: theme.panel, width: 300 },
        overlayColor: 'rgba(0,0,0,0.6)',
        sceneStyle: { backgroundColor: theme.background },
      }}>
      {[...SECTIONS, SETTINGS].map((s) => (
        <Drawer.Screen key={s.name} name={s.name} options={{ title: s.label }} />
      ))}
    </Drawer>
  );
}

function MenuButton({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  const theme = useSignTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuButton,
        { backgroundColor: theme.sign, bottom: insets.bottom + Spacing.three },
        side === 'left' ? { left: Spacing.three } : { right: Spacing.three },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Menu"
      accessibilityHint="Opens the list of sections">
      <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} size={28} tintColor={theme.onSign} />
    </Pressable>
  );
}

/** Sections sit at the bottom of the panel, nearest the thumb; Settings goes last. */
function MenuContent({ state, navigation }: DrawerContentComponentProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    navigation.closeDrawer();
    if (name !== current) navigation.navigate(name);
  };

  return (
    <View
      style={[
        styles.menu,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <Text style={[styles.menuTitle, { color: theme.onPanel }]} accessibilityRole="header">
        Pokédex App
      </Text>
      <View style={styles.entries}>
        {SECTIONS.map((s) => (
          <MenuEntry key={s.name} section={s} selected={s.name === current} onPress={() => go(s.name)} />
        ))}
        <View style={[styles.divider, { backgroundColor: theme.onPanelSecondary }]} />
        <MenuEntry section={SETTINGS} selected={current === SETTINGS.name} onPress={() => go(SETTINGS.name)} />
      </View>
    </View>
  );
}

function MenuEntry({ section, selected, onPress }: { section: Section; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = selected ? theme.onSign : theme.onPanel;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.entry,
        selected && { backgroundColor: theme.sign },
        pressed && !selected && { backgroundColor: 'rgba(255,255,255,0.12)' },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <SymbolView name={section.icon} size={24} tintColor={selected ? theme.onSign : theme.onPanelSecondary} />
      <Text style={[styles.entryLabel, { color }]}>{section.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  menuButton: {
    position: 'absolute',
    width: MenuButtonSize,
    height: MenuButtonSize,
    borderRadius: MenuButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  menu: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  menuTitle: {
    fontFamily: Font.extraBold,
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: Spacing.three,
  },
  entries: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    borderRadius: 28,
  },
  entryLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
    marginHorizontal: Spacing.three,
    opacity: 0.5,
  },
});
