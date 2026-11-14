import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { AppBar } from '@/components/pokemon/app-bar';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { gameFeatures } from '@/components/teams/game-list';
import { MemberRow } from '@/components/teams/member-row';
import { ActionButton, GroupLabel } from '@/components/teams/parts';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { formatMultiplier } from '@/db/queries/pokemon-detail';
import { exportTeam } from '@/db/showdown';
import { teamCoverage, teamDefense } from '@/db/team-analysis';
import { deleteTeam, saveTeam, TEAM_SIZE, useTeam } from '@/db/teams';
import { useGameData, useMemberOptions } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

/** A team: its six slots, where it's weak, what its moves hit, and Showdown export. */
export default function TeamScreen() {
  const { id: param } = useLocalSearchParams<{ id: string }>();
  const id = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const team = useTeam(id);
  const { data, error } = useGameData(team?.versionGroupId);
  const options = useMemberOptions(data, team?.members.map((m) => m.pokemonId) ?? []);
  const [name, setName] = useState<string | null>(null);

  if (!team) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <AppBar title="Team" showTitle />
        <Notice
          icon={{ ios: 'questionmark.circle', android: 'help', web: 'help' }}
          title="This team is gone"
          body="It may have been deleted."
        />
      </View>
    );
  }

  const openMember = (slot: number) =>
    router.push({ pathname: '/team/[id]/member/[slot]', params: { id, slot } });
  const defense = data ? teamDefense(team, data) : [];
  const weakSpots = defense.filter((d) => d.weak > 0).sort((a, b) => b.weak - a.weak || a.resist - b.resist);
  const coverage = data ? teamCoverage(team, data, options) : [];
  const hasAttacks = coverage.some((c) => c.best > 0);

  const share = async () => {
    if (!data) return;
    const text = await exportTeam(db, team, data);
    if (!text) return;
    Share.share({ message: text, title: team.name });
  };

  const confirmDelete = () =>
    Alert.alert(`Delete ${team.name}?`, 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteTeam(team.id);
        },
      },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={team.name} showTitle={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        keyboardShouldPersistTaps="handled">
        <SignBand style={styles.band}>
          <View style={styles.nameRow}>
            <TextInput
              value={name ?? team.name}
              onChangeText={setName}
              onEndEditing={() => {
                const trimmed = (name ?? '').trim();
                if (name !== null && trimmed && trimmed !== team.name) saveTeam({ ...team, name: trimmed });
                setName(null);
              }}
              style={[styles.name, { color: theme.onSign }]}
              selectionColor={theme.onSign}
              cursorColor={theme.onSign}
              accessibilityLabel="Team name"
              accessibilityHint="Edit to rename the team"
              multiline={false}
              returnKeyType="done"
            />
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              size={22}
              tintColor={theme.onSign}
            />
          </View>
          <Text style={[styles.game, { color: theme.onSign }]}>{data?.game.name ?? ' '}</Text>
          {data && gameFeatures(data.game) ? (
            <Text style={[styles.features, { color: theme.onSign }]}>{gameFeatures(data.game)}</Text>
          ) : null}
        </SignBand>

        {error ? (
          <Notice
            icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
            title="The game data didn't load"
            body={error}
          />
        ) : null}

        <SectionSign title="Pokémon" detail={`${team.members.length} of ${TEAM_SIZE}`} />
        {data
          ? team.members.map((m, i) => (
              <MemberRow
                key={`${i}-${m.pokemonId}`}
                member={m}
                data={data}
                options={options.get(m.pokemonId)}
                onPress={() => openMember(i)}
              />
            ))
          : null}
        {team.members.length < TEAM_SIZE ? (
          <Pressable
            onPress={() => router.push({ pathname: '/team/[id]/pick', params: { id, kind: 'pokemon' } })}
            style={({ pressed }) => [
              styles.add,
              { borderColor: theme.rowRule },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}
            accessibilityRole="button">
            <SymbolView name={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }} size={28} tintColor={theme.text} />
            <Text style={[styles.addLabel, { color: theme.text }]}>Add a Pokémon</Text>
          </Pressable>
        ) : null}

        {data && team.members.length > 0 ? (
          <>
            <SectionSign title="Weaknesses" detail="By type" />
            <View style={styles.body}>
              {weakSpots.length === 0 ? (
                <Quiet>No type hits any of them super effectively.</Quiet>
              ) : (
                weakSpots.map((d) => (
                  <View
                    key={d.type.id}
                    style={[styles.defenseRow, { borderBottomColor: theme.rule }]}
                    accessible
                    accessibilityLabel={`${d.type.name}: ${d.weak} weak${d.double ? `, ${d.double} four times` : ''}, ${d.resist} resist, ${d.immune} immune${
                      d.problem ? '. A weak spot' : ''
                    }`}>
                    <View style={styles.defenseType}>
                      <TypeBadge identifier={d.type.identifier} name={d.type.name} />
                    </View>
                    <Text style={[styles.defenseText, { color: theme.text }]}>
                      {d.weak} weak
                      {d.double ? ` (${d.double} at ×4)` : ''}
                      <Text style={{ color: theme.textSecondary }}>
                        {d.resist ? ` · ${d.resist} resist` : ''}
                        {d.immune ? ` · ${d.immune} immune` : ''}
                      </Text>
                    </Text>
                    {d.problem ? (
                      <View style={[styles.flag, { backgroundColor: theme.sign }]}>
                        <SymbolView
                          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                          size={16}
                          tintColor={theme.onSign}
                        />
                        <Text style={[styles.flagLabel, { color: theme.onSign }]}>Weak spot</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
              <Quiet>Counts each Pokémon’s own types. Abilities like Levitate aren’t included.</Quiet>
            </View>

            <SectionSign title="Coverage" detail="Its attacking moves" />
            <View style={styles.body}>
              {!hasAttacks ? (
                <Quiet>Give the team attacking moves to see what they hit.</Quiet>
              ) : (
                <>
                  <GroupLabel>Super effective against</GroupLabel>
                  <View style={styles.badges}>
                    {coverage.filter((c) => c.best > 1).length === 0 ? (
                      <Quiet>Nothing yet.</Quiet>
                    ) : (
                      coverage
                        .filter((c) => c.best > 1)
                        .map((c) => <TypeBadge key={c.type.id} identifier={c.type.identifier} name={c.type.name} />)
                    )}
                  </View>
                  <GroupLabel>Nothing hits harder than neutral</GroupLabel>
                  <View style={styles.badges}>
                    {coverage.filter((c) => c.best <= 1).length === 0 ? (
                      <Quiet>Every type is covered.</Quiet>
                    ) : (
                      coverage
                        .filter((c) => c.best <= 1)
                        .map((c) => (
                          <TypeBadge
                            key={c.type.id}
                            identifier={c.type.identifier}
                            name={c.type.name}
                            suffix={c.best < 1 ? formatMultiplier(c.best) : undefined}
                          />
                        ))
                    )}
                  </View>
                </>
              )}
            </View>
          </>
        ) : null}

        <SectionSign title="Team" />
        <View style={[styles.body, styles.actions]}>
          {team.members.length > 0 ? (
            <ActionButton
              label="Export to Showdown"
              icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
              onPress={share}
              accessibilityHint="Shares the team as Showdown text, to copy or send"
            />
          ) : null}
          <ActionButton
            destructive
            label="Delete team"
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            onPress={confirmDelete}
          />
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
    gap: Spacing.one,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontFamily: Font.extraBold,
    fontSize: 26,
    lineHeight: 32,
    paddingVertical: Spacing.one,
    paddingHorizontal: 0,
  },
  game: {
    fontFamily: Font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  features: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    margin: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  addLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.three,
  },
  defenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  defenseType: {
    width: 96,
  },
  defenseText: {
    flex: 1,
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 4,
  },
  flagLabel: {
    fontFamily: Font.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
