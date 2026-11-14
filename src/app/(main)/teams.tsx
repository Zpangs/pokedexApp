import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { SignBand } from '@/components/sign-band';
import { ActionButton, TeamSprites } from '@/components/teams/parts';
import { Font, MenuButtonInset, Spacing } from '@/constants/theme';
import { type Team, useTeams } from '@/db/teams';
import { useTeamGames } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

/** Saved teams, newest change first, with buttons to start or import one. */
export default function TeamsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const teams = useTeams();
  const { games } = useTeamGames();
  const gameName = (id: number) => games?.find((g) => g.versionGroupId === id)?.name ?? '';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SignBand style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
        <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
          Teams
        </Text>
        {teams.length > 0 ? (
          <Text style={[styles.count, { color: theme.onSign }]}>
            {teams.length} {teams.length === 1 ? 'team' : 'teams'}
          </Text>
        ) : null}
      </SignBand>

      <FlatList
        data={teams}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ paddingBottom: MenuButtonInset + Spacing.three }}
        ListHeaderComponent={
          <View style={styles.actions}>
            <ActionButton
              primary
              label="New team"
              icon={{ ios: 'plus', android: 'add', web: 'add' }}
              onPress={() => router.push('/team/new')}
              accessibilityHint="Pick the game the team is for"
            />
            <ActionButton
              label="Import from Showdown"
              icon={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
              onPress={() => router.push('/team/import')}
            />
          </View>
        }
        ListEmptyComponent={
          <Notice
            icon={{ ios: 'person.3', android: 'groups', web: 'groups' }}
            title="No teams yet"
            body="Start one for the game you're playing. It only shows the Pokémon, moves, items and mechanics that game has."
          />
        }
        renderItem={({ item }) => <TeamRow team={item} game={gameName(item.versionGroupId)} />}
      />
    </View>
  );
}

function TeamRow({ team, game }: { team: Team; game: string }) {
  const theme = useTheme();
  const count = team.members.length;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/team/[id]', params: { id: team.id } })}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.rule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${team.name}, ${game}, ${count} of 6 Pokémon`}>
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {team.name}
      </Text>
      <Text style={[styles.game, { color: theme.textSecondary }]}>{game}</Text>
      <TeamSprites pokemonIds={team.members.map((m) => m.pokemonId)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  count: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  game: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
});
