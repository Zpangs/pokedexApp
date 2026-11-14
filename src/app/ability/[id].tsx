import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { PokemonRow } from '@/components/pokemon/pokemon-row';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet, SectionBody } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { Font, Spacing } from '@/constants/theme';
import { type AbilityDetail, type AbilityHolder, loadAbility } from '@/db/queries/abilities';
import { plural } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'band'; key: string }
  | { kind: 'sign'; key: string; title: string; detail?: string }
  | { kind: 'effect'; key: string }
  | { kind: 'changes'; key: string }
  | { kind: 'group'; key: string; label: string }
  | { kind: 'holder'; key: string; holder: AbilityHolder; trailing?: string; trailingLabel?: string }
  | { kind: 'note'; key: string; text: string };

export default function AbilityScreen() {
  const { id: param } = useLocalSearchParams<{ id: string }>();
  const id = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // undefined while loading, null when there's no such ability
  const [ability, setAbility] = useState<AbilityDetail | null | undefined>(undefined);
  const [bandHeight, setBandHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    loadAbility(db, id).then((a) => live && setAbility(a));
    return () => {
      live = false;
    };
  }, [db, id]);

  // One list for the whole page, so an ability dozens of Pokémon have still scrolls smoothly
  const { items, stickyIndices } = useMemo(() => {
    const items: Item[] = [{ kind: 'band', key: 'band' }];
    const stickyIndices: number[] = [];
    if (!ability) return { items, stickyIndices };

    const sign = (key: string, title: string, detail?: string) => {
      stickyIndices.push(items.length);
      items.push({ kind: 'sign', key, title, detail });
    };

    sign('s-effect', 'Effect');
    items.push({ kind: 'effect', key: 'effect' });

    if (ability.changes.length > 0) {
      sign('s-changes', 'Changes', plural(ability.changes.length, 'game'));
      items.push({ kind: 'changes', key: 'changes' });
    }

    const count = new Set(ability.holders.map((h) => h.pokemonId)).size;
    sign('s-pokemon', 'Pokémon', `${count.toLocaleString()} Pokémon`);
    if (ability.holders.length === 0) {
      items.push({ kind: 'note', key: 'none', text: 'No Pokémon in the Pokédex data have this ability.' });
    }
    const groups = [
      { label: 'Ability', list: ability.holders.filter((h) => !h.isHidden) },
      { label: 'Hidden ability', list: ability.holders.filter((h) => h.isHidden) },
    ];
    for (const { label, list } of groups) {
      if (list.length === 0) continue;
      items.push({ kind: 'group', key: `g-${label}`, label: `${label} · ${list.length}` });
      for (const holder of list) {
        items.push({ kind: 'holder', key: `${label}-${holder.pokemonId}`, holder });
      }
    }
    if (ability.formerHolders.length > 0) {
      items.push({ kind: 'group', key: 'g-former', label: `Formerly · ${ability.formerHolders.length}` });
      for (const holder of ability.formerHolders) {
        items.push({
          kind: 'holder',
          key: `former-${holder.pokemonId}`,
          holder,
          trailing: `To Gen ${holder.until}`,
          trailingLabel: `had it up to Generation ${holder.until}`,
        });
      }
    }
    return { items, stickyIndices };
  }, [ability]);

  if (ability === null || !Number.isInteger(id)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title="" showTitle={false} />
        <View style={styles.notice}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>No ability #{param}</Text>
          <Quiet>This ability isn’t in the Pokédex data.</Quiet>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={ability?.name ?? ''} showTitle={collapsed} />
      <FlatList
        // Remount when the signs change: shifting sticky headers inside a mounted list crashes Android
        key={stickyIndices.join(',')}
        removeClippedSubviews={false}
        data={items}
        keyExtractor={(item) => item.key}
        stickyHeaderIndices={stickyIndices}
        initialNumToRender={20}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - 24;
          if (past !== collapsed) setCollapsed(past);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'band':
              return (
                <View onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
                  <AbilityBand ability={ability} />
                </View>
              );
            case 'sign':
              return <SectionSign title={item.title} detail={item.detail} />;
            case 'effect':
              return ability ? <EffectBody ability={ability} /> : null;
            case 'changes':
              return ability ? <ChangesBody ability={ability} /> : null;
            case 'group':
              return (
                <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>{item.label}</Text>
              );
            case 'holder':
              return (
                <PokemonRow
                  pokemon={item.holder}
                  trailing={item.trailing}
                  trailingLabel={item.trailingLabel}
                />
              );
            case 'note':
              return (
                <SectionBody>
                  <Quiet>{item.text}</Quiet>
                </SectionBody>
              );
          }
        }}
      />
    </View>
  );
}

/** The gradient band: the name and, in one line, what it does. */
function AbilityBand({ ability }: { ability: AbilityDetail | undefined }) {
  const theme = useTheme();
  return (
    <SignBand style={styles.band}>
      <Text style={[styles.name, { color: theme.onSign }]} accessibilityRole="header">
        {ability?.name ?? ''}
      </Text>
      {ability?.effect ? (
        <Text style={[styles.summary, { color: theme.onSign }]}>{ability.effect}</Text>
      ) : null}
    </SignBand>
  );
}

function EffectBody({ ability }: { ability: AbilityDetail }) {
  const theme = useTheme();
  return (
    <SectionBody>
      {ability.details.map((paragraph, i) => (
        <Text key={i} style={[styles.prose, { color: theme.text }]}>
          {paragraph}
        </Text>
      ))}
      {ability.flavorText ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>In-game description</Text>
          <Text style={[styles.prose, { color: theme.text }]}>{ability.flavorText}</Text>
        </View>
      ) : null}
      {ability.details.length === 0 && !ability.flavorText && !ability.effect ? (
        <Quiet>No description recorded.</Quiet>
      ) : null}
      <Quiet>Introduced in Gen {ability.generation}</Quiet>
    </SectionBody>
  );
}

function ChangesBody({ ability }: { ability: AbilityDetail }) {
  const theme = useTheme();
  return (
    <SectionBody>
      {ability.changes.map((c) => (
        <View key={c.since} style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Before {c.since}</Text>
          <Text style={[styles.prose, { color: theme.text }]}>{c.before}</Text>
        </View>
      ))}
    </SectionBody>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  name: {
    fontFamily: Font.extraBold,
    fontSize: 32,
    lineHeight: 38,
  },
  summary: {
    fontFamily: Font.medium,
    fontSize: 17,
    lineHeight: 24,
  },
  group: {
    gap: Spacing.one,
  },
  groupLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  prose: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  groupHeading: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  notice: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  noticeTitle: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 26,
  },
});
