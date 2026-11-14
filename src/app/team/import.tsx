import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { SectionSign } from '@/components/pokemon/section-sign';
import { GameList } from '@/components/teams/game-list';
import { ActionButton, ChoiceRow } from '@/components/teams/parts';
import { Font, Spacing } from '@/constants/theme';
import { loadGameData, type TeamGame } from '@/db/queries/team-builder';
import { importTeam } from '@/db/showdown';
import { createTeam } from '@/db/teams';
import { useTeamGames } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

/** Paste a team from Showdown (or any builder that exports its text) into a game. */
export default function ImportScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { games } = useTeamGames();
  const [game, setGame] = useState<TeamGame | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const data = await loadGameData(db, game);
      const { members, problems } = await importTeam(db, text, data);
      if (members.length === 0) {
        Alert.alert('Nothing to import', problems[0] ?? 'Paste a team exported from Showdown.');
        return;
      }
      const id = createTeam('Imported team', game.versionGroupId, members);
      router.replace({ pathname: '/team/[id]', params: { id } });
      if (problems.length) Alert.alert('Some parts were left out', problems.join('\n'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title="Import from Showdown" showTitle />
      {!game ? (
        games ? (
          <GameList
            games={games}
            onPick={setGame}
            bottomInset={insets.bottom + Spacing.three}
            header={
              <Text style={[styles.intro, { color: theme.textSecondary }]}>
                First, which game is the team for? Anything that game doesn’t have is left out.
              </Text>
            }
          />
        ) : null
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
          keyboardShouldPersistTaps="handled">
          <ChoiceRow label="Game" value={game.name} onPress={() => setGame(null)} accessibilityHint="Pick another game" />
          <SectionSign title="Team text" />
          <View style={styles.body}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={'Garchomp @ Choice Scarf\nAbility: Rough Skin\nJolly Nature\n- Earthquake\n…'}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.rowRule, backgroundColor: theme.backgroundElement },
              ]}
              autoCorrect={false}
              autoCapitalize="none"
              textAlignVertical="top"
              accessibilityLabel="Team text"
              accessibilityHint="Paste the text Showdown exports"
            />
            <ActionButton
              primary
              label={busy ? 'Importing…' : 'Import team'}
              icon={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
              onPress={run}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  intro: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    padding: Spacing.three,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    minHeight: 240,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
});
