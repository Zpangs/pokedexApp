import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { SectionSign } from '@/components/pokemon/section-sign';
import { SignBand } from '@/components/sign-band';
import { TypeButton } from '@/components/types/type-button';
import { MenuButtonInset, Font, Spacing } from '@/constants/theme';
import {
  type BattleType,
  loadNatures,
  loadTypeData,
  type Nature,
  NATURE_STAT_ORDER,
  statLabel,
} from '@/db/queries/types';
import { useTheme } from '@/hooks/use-theme';

type Row =
  | { kind: 'sign'; key: string; title: string; detail?: string }
  | { kind: 'types'; key: string }
  | { kind: 'group'; key: string; label: string }
  | { kind: 'nature'; key: string; nature: Nature };

/** The 18 types (each opens its matchups) and the 25 natures, grouped by the stat they raise. */
export default function TypesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [types, setTypes] = useState<BattleType[] | null>(null);
  const [natures, setNatures] = useState<Nature[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadTypeData(db), loadNatures(db)]).then(([t, n]) => {
      setTypes(t.types);
      setNatures(n);
    }, (e: unknown) => setError(String(e)));
  }, [db]);

  const { rows, stickyIndices } = useMemo(() => {
    const rows: Row[] = [];
    const stickyIndices: number[] = [];
    if (!types || !natures) return { rows, stickyIndices };
    const sign = (key: string, title: string, detail?: string) => {
      stickyIndices.push(rows.length);
      rows.push({ kind: 'sign', key, title, detail });
    };

    sign('s-types', 'Types', String(types.length));
    rows.push({ kind: 'types', key: 'types' });

    sign('s-natures', 'Natures', String(natures.length));
    // Grouped the way players pick them: by the stat they want raised
    for (const stat of [...NATURE_STAT_ORDER, null]) {
      const list = natures.filter((n) => n.raisesId === stat);
      rows.push({
        kind: 'group',
        key: `g-${stat ?? 'neutral'}`,
        label: stat ? `Raises ${statLabel(stat)}` : 'Neutral: no stat change',
      });
      for (const nature of list) rows.push({ kind: 'nature', key: `n-${nature.id}`, nature });
    }
    return { rows, stickyIndices };
  }, [types, natures]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SignBand style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
        <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
          Types & Natures
        </Text>
      </SignBand>

      {error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The type data didn't load"
          body={`Rebuild it with npm run build-db, then restart the app. (${error})`}
        />
      ) : (
        <FlatList
          key={stickyIndices.join(',')}
          removeClippedSubviews={false}
          data={rows}
          keyExtractor={(row) => row.key}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={{ paddingBottom: MenuButtonInset + Spacing.three }}
          renderItem={({ item: row }) => {
            switch (row.kind) {
              case 'sign':
                return <SectionSign title={row.title} detail={row.detail} />;
              case 'types':
                return (
                  <View style={styles.grid}>
                    {(types ?? []).map((t) => (
                      <TypeButton
                        key={t.id}
                        identifier={t.identifier}
                        name={t.name}
                        onPress={() =>
                          router.push({ pathname: '/type/[id]', params: { id: t.id } })
                        }
                        accessibilityHint="Opens its matchups"
                        style={styles.gridButton}
                      />
                    ))}
                  </View>
                );
              case 'group':
                return (
                  <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>{row.label}</Text>
                );
              case 'nature':
                return <NatureRow nature={row.nature} />;
            }
          }}
        />
      )}
    </View>
  );
}

/** A nature: name, the stat it raises and lowers by 10%, and the berry flavors it likes. */
function NatureRow({ nature }: { nature: Nature }) {
  const theme = useTheme();
  const flavors =
    nature.likes && nature.dislikes ? `Likes ${nature.likes} · Dislikes ${nature.dislikes}` : null;
  return (
    <View
      style={[styles.nature, { borderBottomColor: theme.rule }]}
      accessible
      accessibilityLabel={
        nature.raises
          ? `${nature.name}: raises ${nature.raises}, lowers ${nature.lowers}. ${flavors ?? ''}`
          : `${nature.name}: no stat change`
      }>
      <View style={styles.natureText}>
        <Text style={[styles.natureName, { color: theme.text }]}>{nature.name}</Text>
        {flavors ? (
          <Text style={[styles.flavors, { color: theme.textSecondary }]}>{flavors}</Text>
        ) : null}
      </View>
      {nature.raises ? (
        <View style={styles.stats}>
          <Text style={[styles.stat, { color: theme.text }]}>+{nature.raises}</Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>−{nature.lowers}</Text>
        </View>
      ) : (
        <Text style={[styles.flavors, { color: theme.textSecondary }]}>No change</Text>
      )}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  // Three to a row, so the 18 types make an even six-row grid
  gridButton: {
    width: '30%',
    flexGrow: 1,
  },
  groupHeading: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  nature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  natureText: {
    flex: 1,
  },
  natureName: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  flavors: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  stats: {
    alignItems: 'flex-end',
  },
  stat: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
