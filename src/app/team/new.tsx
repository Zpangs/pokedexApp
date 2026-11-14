import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { AppBar } from '@/components/pokemon/app-bar';
import { GameList } from '@/components/teams/game-list';
import { Font, Spacing } from '@/constants/theme';
import { createTeam } from '@/db/teams';
import { useTeamGames } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

/** Step one of a new team: the game it's for. That decides everything the builder offers. */
export default function NewTeamScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { games, error } = useTeamGames();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title="New team" showTitle />
      {error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The games didn't load"
          body={error}
        />
      ) : games ? (
        <GameList
          games={games}
          bottomInset={insets.bottom + Spacing.three}
          header={
            <Text style={[styles.intro, { color: theme.textSecondary }]}>
              Which game is the team for? You’ll only see the Pokémon, moves, items and mechanics
              that game has.
            </Text>
          }
          onPick={(game) => {
            const id = createTeam(`${game.name} team`, game.versionGroupId);
            router.replace({ pathname: '/team/[id]', params: { id } });
          }}
        />
      ) : null}
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
});
