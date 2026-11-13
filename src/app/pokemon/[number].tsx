import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { IdentityBand } from '@/components/pokemon/identity-band';
import { SectionSign } from '@/components/pokemon/section-sign';
import {
  AbilitiesSection,
  AboutSection,
  EncountersSection,
  EvolutionSection,
  GamePicker,
  MatchupsSection,
  MovesSection,
  Quiet,
  SectionBody,
  StatsSection,
} from '@/components/pokemon/sections';
import { Font, Spacing } from '@/constants/theme';
import { formatDexNumber } from '@/db/queries/national-dex';
import {
  type Encounter,
  type EvolutionStage,
  type GameOption,
  type LearnedMove,
  loadEncounters,
  loadEvolutionChain,
  loadForm,
  loadLearnset,
  loadLearnsetGames,
  loadSpecies,
  type PokemonForm,
  type SpeciesInfo,
} from '@/db/queries/pokemon-detail';
import { useTheme } from '@/hooks/use-theme';

/** Pokémon Champions only has training moves; prefer a main-series game when picking a default. */
const NOT_A_DEFAULT_GAME = new Set(['Champions']);

/** The section signs' positions among the scroll view's children; they stick while scrolling. */
const STICKY_SIGNS = [1, 3, 5, 7, 9, 11, 13];

export default function PokemonScreen() {
  // `form` is a `pokemon.id` to open on, e.g. Alolan Raichu from the Alola Dex
  const { number: param, form: formParam } = useLocalSearchParams<{ number: string; form?: string }>();
  const number = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // undefined while loading, null when there's no such Pokémon
  const [species, setSpecies] = useState<SpeciesInfo | null | undefined>(undefined);
  const [pokemonId, setPokemonId] = useState<number | null>(null);
  const [form, setForm] = useState<PokemonForm | null>(null);
  const [chain, setChain] = useState<{ stages: EvolutionStage[]; current: number } | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [game, setGame] = useState<number | null>(null);
  const [moves, setMoves] = useState<LearnedMove[] | null>(null);
  const [bandHeight, setBandHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    loadSpecies(db, number).then((s) => {
      if (!live) return;
      setSpecies(s);
      if (!s) return;
      const requested = s.varieties.find((v) => v.pokemonId === Number(formParam));
      setPokemonId((requested ?? s.varieties[0])?.pokemonId ?? null);
    });
    return () => {
      live = false;
    };
  }, [db, number, formParam]);

  // Regional forms have their own evolution lines (Paldean Wooper into Clodsire)
  const chainId = species?.evolutionChainId ?? null;
  useEffect(() => {
    if (chainId === null || pokemonId === null) return;
    let live = true;
    loadEvolutionChain(db, chainId, pokemonId).then((c) => live && setChain(c));
    return () => {
      live = false;
    };
  }, [db, chainId, pokemonId]);

  // Everything that differs between forms (Mega, regional, Gigantamax…)
  useEffect(() => {
    if (pokemonId === null) return;
    let live = true;
    Promise.all([
      loadForm(db, pokemonId),
      loadEncounters(db, pokemonId),
      loadLearnsetGames(db, pokemonId),
    ]).then(([f, e, g]) => {
      if (!live) return;
      setForm(f);
      setEncounters(e);
      setGames(g);
      setGame((current) =>
        g.some((x) => x.versionGroupId === current)
          ? current
          : (g.find((x) => !NOT_A_DEFAULT_GAME.has(x.name)) ?? g[0])?.versionGroupId ?? null
      );
    });
    return () => {
      live = false;
    };
  }, [db, pokemonId]);

  useEffect(() => {
    if (pokemonId === null || game === null) return;
    let live = true;
    loadLearnset(db, pokemonId, game).then((m) => live && setMoves(m));
    return () => {
      live = false;
    };
  }, [db, pokemonId, game]);

  const variety = species?.varieties.find((v) => v.pokemonId === pokemonId);
  // The species name for the default form ("Oinkologne", not "Male Oinkologne"),
  // the form's own name for the others ("Mega Charizard X")
  const displayName = variety && !variety.isDefault ? variety.name : species?.name;
  const title = `${formatDexNumber(number)}  ${displayName ?? ''}`;

  if (species === null || !Number.isInteger(number)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title="" showTitle={false} />
        <View style={styles.notice}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>No Pokémon #{param}</Text>
          <Quiet>The National Dex goes from 1 to 1,025.</Quiet>
        </View>
      </View>
    );
  }

  const ready = species !== undefined && form !== null;
  const stats = form?.stats ?? [];
  const total = stats.reduce((sum, s) => sum + s.value, 0);
  const gameName = games.find((g) => g.versionGroupId === game)?.name;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={title} showTitle={collapsed} />
      <ScrollView
        // Remount once loaded: changing sticky headers inside a mounted view crashes Android
        key={ready ? 'ready' : 'loading'}
        stickyHeaderIndices={ready ? STICKY_SIGNS : undefined}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - 24;
          if (past !== collapsed) setCollapsed(past);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}>
        <View onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
          <IdentityBand
            number={number}
            name={displayName}
            genus={species?.genus}
            types={form?.types}
            pokemonId={pokemonId}
            varieties={species?.varieties ?? []}
            onSelectVariety={setPokemonId}
          />
        </View>

        {ready && [
          <SectionSign key="s-match" title="Type matchups" detail="When defending" />,
          <MatchupsSection key="b-match" matchups={form.matchups} />,

          <SectionSign key="s-ab" title="Abilities" detail={String(form.abilities.length)} />,
          <AbilitiesSection key="b-ab" abilities={form.abilities} />,

          <SectionSign key="s-stats" title="Base stats" detail={`Total ${total}`} />,
          <StatsSection key="b-stats" stats={stats} />,

          <SectionSign key="s-evo" title="Evolution" />,
          <EvolutionSection
            key="b-evo"
            stages={chain?.stages ?? []}
            current={chain?.current ?? null}
          />,

          <SectionSign
            key="s-loc"
            title="Where to find"
            detail={
              encounters.length
                ? `${new Set(encounters.map((e) => e.versionGroupOrder)).size} games`
                : undefined
            }
          />,
          <EncountersSection key="b-loc" encounters={encounters} />,

          <SectionSign key="s-moves" title="Moves" detail={gameName} />,
          <View key="b-moves">
            {games.length > 0 ? (
              <>
                <GamePicker games={games} selected={game} onSelect={setGame} />
                <MovesSection moves={moves} />
              </>
            ) : (
              <SectionBody>
                <Quiet>No learnset data for this form.</Quiet>
              </SectionBody>
            )}
          </View>,

          <SectionSign key="s-about" title="Pokédex entry" />,
          <AboutSection
            key="b-about"
            species={species}
            height={form.height}
            weight={form.weight}
          />,
        ]}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
