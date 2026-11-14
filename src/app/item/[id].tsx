import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoveRow } from '@/components/moves/move-row';
import { AppBar } from '@/components/pokemon/app-bar';
import { PokemonRow } from '@/components/pokemon/pokemon-row';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet, SectionBody } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { type ItemDetail, type ItemLocation, loadItem, type MachineMove } from '@/db/queries/items';
import { plural } from '@/db/queries/national-dex';
import type { ListedPokemon } from '@/db/queries/pokemon-list';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'band'; key: string }
  | { kind: 'sign'; key: string; title: string; detail?: string }
  | { kind: 'effect'; key: string }
  | { kind: 'berry'; key: string }
  | { kind: 'group'; key: string; label: string }
  | { kind: 'machine'; key: string; entry: MachineMove }
  | { kind: 'location'; key: string; location: ItemLocation }
  | { kind: 'pokemon'; key: string; pokemon: ListedPokemon; trailing?: string; trailingLabel?: string }
  | { kind: 'note'; key: string; text: string };

export default function ItemScreen() {
  const { id: param } = useLocalSearchParams<{ id: string }>();
  const id = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // undefined while loading, null when there's no such item
  const [item, setItem] = useState<ItemDetail | null | undefined>(undefined);
  const [bandHeight, setBandHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    loadItem(db, id).then((i) => live && setItem(i));
    return () => {
      live = false;
    };
  }, [db, id]);

  const { items, stickyIndices } = useMemo(() => {
    const items: Item[] = [{ kind: 'band', key: 'band' }];
    const stickyIndices: number[] = [];
    if (!item) return { items, stickyIndices };

    const sign = (key: string, title: string, detail?: string) => {
      stickyIndices.push(items.length);
      items.push({ kind: 'sign', key, title, detail });
    };

    // A machine's band already says what it does; its Teaches list is the detail
    if (item.machine.length === 0) {
      sign('s-effect', 'Effect');
      items.push({ kind: 'effect', key: 'effect' });
    }

    if (item.locations.length > 0) {
      sign('s-where', 'Where to find', plural(item.locations.length, 'game'));
      for (const location of item.locations) {
        items.push({ kind: 'location', key: `l-${location.games}`, location });
      }
      items.push({ kind: 'note', key: 'where-source', text: 'Locations from Serebii.net.' });
    }

    if (item.berry) {
      sign('s-berry', 'Berry');
      items.push({ kind: 'berry', key: 'berry' });
    }

    if (item.machine.length > 0) {
      sign('s-teaches', 'Teaches', plural(item.machine.length, 'move'));
      for (const entry of item.machine) {
        items.push({ kind: 'machine', key: `m-${entry.move.id}`, entry });
      }
    }

    if (item.evolutions.length > 0) {
      sign('s-evolution', 'Evolution', `${item.evolutions.length} Pokémon`);
      const groups = [
        { label: 'Evolves when it’s used on', list: item.evolutions.filter((e) => !e.held) },
        { label: 'Evolves while holding it', list: item.evolutions.filter((e) => e.held) },
      ];
      for (const { label, list } of groups) {
        if (list.length === 0) continue;
        items.push({ kind: 'group', key: `g-${label}`, label: `${label} · ${list.length}` });
        for (const pokemon of list) {
          items.push({ kind: 'pokemon', key: `e-${label}-${pokemon.pokemonId}`, pokemon });
        }
      }
    }

    if (item.wildHolders.length > 0) {
      sign('s-wild', 'Held by wild Pokémon', `${item.wildHolders.length} Pokémon`);
      items.push({
        kind: 'note',
        key: 'wild-note',
        text: 'The chance a wild one is holding it, in the newest game where it can be.',
      });
      for (const holder of item.wildHolders) {
        items.push({
          kind: 'pokemon',
          key: `w-${holder.pokemonId}`,
          pokemon: holder,
          trailing: `${holder.rarity}%`,
          trailingLabel: `${holder.rarity}% chance in ${holder.game}`,
        });
      }
    }
    return { items, stickyIndices };
  }, [item]);

  if (item === null || !Number.isInteger(id)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title="" showTitle={false} />
        <View style={styles.notice}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>No item #{param}</Text>
          <Quiet>This item isn’t in the Pokédex data.</Quiet>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={item?.name ?? ''} showTitle={collapsed} />
      <FlatList
        // Remount when the signs change: shifting sticky headers inside a mounted list crashes Android
        key={stickyIndices.join(',')}
        removeClippedSubviews={false}
        data={items}
        keyExtractor={(i) => i.key}
        stickyHeaderIndices={stickyIndices}
        initialNumToRender={20}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - 24;
          if (past !== collapsed) setCollapsed(past);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        renderItem={({ item: row }) => {
          switch (row.kind) {
            case 'band':
              return (
                <View onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
                  <ItemBand item={item} />
                </View>
              );
            case 'sign':
              return <SectionSign title={row.title} detail={row.detail} />;
            case 'effect':
              return item ? <EffectBody item={item} /> : null;
            case 'berry':
              return item?.berry ? <BerryBody item={item} /> : null;
            case 'group':
              return (
                <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>{row.label}</Text>
              );
            case 'machine':
              return (
                <View>
                  <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>
                    {row.entry.games.join(' · ')}
                  </Text>
                  <MoveRow move={row.entry.move} />
                </View>
              );
            case 'location':
              return <LocationBody location={row.location} />;
            case 'pokemon':
              return (
                <PokemonRow
                  pokemon={row.pokemon}
                  trailing={row.trailing}
                  trailingLabel={row.trailingLabel}
                />
              );
            case 'note':
              return (
                <View style={styles.note}>
                  <Quiet>{row.text}</Quiet>
                </View>
              );
          }
        }}
      />
    </View>
  );
}

/** The gradient band: icon, name, kind and what it does, then the numbers. */
function ItemBand({ item }: { item: ItemDetail | undefined }) {
  const theme = useTheme();
  const stats: [string, string][] = item
    ? [
        ...(item.cost > 0 ? [['Price', item.cost.toLocaleString()] as [string, string]] : []),
        ...(item.flingPower ? [['Fling power', String(item.flingPower)] as [string, string]] : []),
      ]
    : [];

  return (
    <SignBand style={styles.band}>
      <View style={styles.titleRow}>
        {item ? (
          <View style={styles.iconPlate}>
            <Image
              source={sprites.item(item.identifier)}
              style={styles.icon}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}
        <View style={styles.titleText}>
          <Text style={[styles.name, { color: theme.onSign }]} accessibilityRole="header">
            {item?.name ?? ''}
          </Text>
          {item ? (
            <Text style={[styles.kind, { color: theme.onSign }]}>
              {item.category === item.pocket ? item.pocket : `${item.category} · ${item.pocket}`}
            </Text>
          ) : null}
        </View>
      </View>
      {item?.effect ? (
        <Text style={[styles.summary, { color: theme.onSign }]}>{item.effect}</Text>
      ) : null}
      {stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map(([label, value]) => (
            <View key={label} style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
              <Text style={[styles.statValue, { color: theme.onSign }]} maxFontSizeMultiplier={1.3}>
                {value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.onSign }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </SignBand>
  );
}

function EffectBody({ item }: { item: ItemDetail }) {
  const theme = useTheme();
  const facts = [...item.flags, item.flingEffect ? `Fling: ${item.flingEffect}` : null].filter(
    (f): f is string => f !== null
  );

  return (
    <SectionBody>
      {item.details.map((section, i) => (
        <View key={i} style={styles.group}>
          {section.label ? (
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{section.label}</Text>
          ) : null}
          {section.blocks.map((block, j) =>
            block.kind === 'text' ? (
              <Text key={j} style={[styles.prose, { color: theme.text }]}>
                {block.text}
              </Text>
            ) : (
              <View key={j} style={styles.list}>
                {block.items.map((entry, k) => (
                  <View key={k} style={styles.bullet}>
                    <Text style={[styles.prose, { color: theme.text }]}>•</Text>
                    <Text style={[styles.prose, styles.bulletText, { color: theme.text }]}>{entry}</Text>
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      ))}
      {item.flavorText ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>In-game description</Text>
          <Text style={[styles.prose, { color: theme.text }]}>{item.flavorText}</Text>
        </View>
      ) : null}
      {item.details.length === 0 && !item.flavorText && !item.effect ? (
        <Quiet>No description recorded.</Quiet>
      ) : null}
      {facts.length > 0 ? <Quiet>{facts.join(' · ')}</Quiet> : null}
    </SectionBody>
  );
}

/** One game: where the item lies around or is given, then where it's sold. */
function LocationBody({ location }: { location: ItemLocation }) {
  const theme = useTheme();
  return (
    <View style={styles.location}>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{location.games}</Text>
      {location.found.map((line, i) => (
        <Text key={`f${i}`} style={[styles.prose, { color: theme.text }]}>
          {line}
        </Text>
      ))}
      {location.shops.length > 0 ? (
        <Text style={[styles.prose, { color: theme.text }]}>
          <Text style={styles.strongInline}>Sold at </Text>
          {location.shops.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function BerryBody({ item }: { item: ItemDetail }) {
  const theme = useTheme();
  const berry = item.berry!;
  const facts: [string, string][] = [
    ...(berry.firmness ? [['Firmness', berry.firmness] as [string, string]] : []),
    ...(berry.growthTime ? [['Growth', `${plural(berry.growthTime, 'hour')} per stage`] as [string, string]] : []),
    ...(berry.maxHarvest ? [['Harvest', `Up to ${berry.maxHarvest} per tree`] as [string, string]] : []),
    ...(berry.size ? [['Size', `${(berry.size / 10).toLocaleString()} cm`] as [string, string]] : []),
  ];

  return (
    <SectionBody>
      {berry.naturalGiftType ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Natural Gift</Text>
          <View style={styles.badges}>
            <TypeBadge identifier={berry.naturalGiftType.identifier} name={berry.naturalGiftType.name} />
            {berry.naturalGiftPower ? (
              <Text style={[styles.strong, { color: theme.text }]}>{berry.naturalGiftPower} power</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {facts.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.prose, styles.factValue, { color: theme.text }]}>{value}</Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Item icons are drawn for a light bag screen; a white plate keeps dark ones visible on the band
  iconPlate: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 56,
    height: 56,
  },
  titleText: {
    flex: 1,
  },
  name: {
    fontFamily: Font.extraBold,
    fontSize: 32,
    lineHeight: 38,
  },
  kind: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  summary: {
    fontFamily: Font.medium,
    fontSize: 17,
    lineHeight: 24,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
    marginTop: Spacing.one,
  },
  stat: {
    minWidth: 56,
  },
  statValue: {
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: Font.medium,
    fontSize: 13,
    lineHeight: 18,
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
  strong: {
    fontFamily: Font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  list: {
    gap: Spacing.one,
  },
  bullet: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletText: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fact: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  factLabel: {
    width: 88,
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 22,
  },
  factValue: {
    flex: 1,
  },
  location: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  strongInline: {
    fontFamily: Font.bold,
  },
  groupHeading: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  note: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
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
