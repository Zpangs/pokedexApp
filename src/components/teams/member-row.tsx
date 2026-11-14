import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import type { GameData, MemberOptions } from '@/db/queries/team-builder';
import { sprites } from '@/db/sprites';
import type { TeamMember } from '@/db/teams';
import { useTheme } from '@/hooks/use-theme';

/** A team member: sprite, name, types in this game, and its item, ability and moves at a glance. */
export function MemberRow({
  member,
  data,
  options,
  onPress,
}: {
  member: TeamMember;
  data: GameData;
  options: MemberOptions | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const pokemon = data.pokemonById.get(member.pokemonId);
  const item = member.itemId ? data.itemById.get(member.itemId) : undefined;
  const ability = options?.abilities.find((a) => a.id === member.abilityId);
  const moves = member.moves
    .map((id) => (id ? options?.moveById.get(id)?.name : undefined))
    .filter(Boolean)
    .join(' · ');
  const name = member.nickname ?? pokemon?.name ?? '?';
  const facts = [ability?.name, item?.name].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.rule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}${member.nickname && pokemon ? `, ${pokemon.name}` : ''}. ${facts}. ${
        moves || 'No moves yet'
      }`}
      accessibilityHint="Edit this Pokémon">
      <Image source={sprites.sprite(member.pokemonId)} style={styles.sprite} contentFit="contain" transition={0} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
          {member.nickname && pokemon ? (
            <Text style={[styles.species, { color: theme.textSecondary }]}>{`  ${pokemon.name}`}</Text>
          ) : null}
        </Text>
        <View style={styles.badges}>
          {pokemon?.types.map((t) => <TypeBadge key={t.identifier} identifier={t.identifier} name={t.name} />)}
        </View>
        {facts ? <Text style={[styles.facts, { color: theme.text }]}>{facts}</Text> : null}
        <Text style={[styles.facts, { color: theme.textSecondary }]} numberOfLines={2}>
          {moves || 'No moves yet'}
        </Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={22}
        tintColor={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sprite: {
    width: 64,
    height: 64,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  species: {
    fontFamily: Font.medium,
    fontSize: 14,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  facts: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
