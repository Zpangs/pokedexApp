import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  title: string;
  body: string;
};

/** A full-width message in place of a list: nothing matches, or the data didn't load. */
export function Notice({ icon, title, body }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.notice}>
      <SymbolView name={icon} size={40} tintColor={theme.text} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 26,
    marginTop: Spacing.two,
  },
  body: {
    fontFamily: Font.regular,
    fontSize: 16,
    lineHeight: 24,
  },
});
