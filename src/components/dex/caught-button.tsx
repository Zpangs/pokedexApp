import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSignTheme } from '@/hooks/use-dex-theme';

type Props = { caught: boolean; name: string; onToggle: () => void };

/**
 * The caught mark at the end of a Dex row: an empty ring, or a filled circle with a tick in the
 * dex's colour. 48dp to tap, and it says "caught" or "not caught" to screen readers.
 */
export const CaughtButton = memo(function CaughtButton({ caught, name, onToggle }: Props) {
  const theme = useSignTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.target, pressed && { opacity: 0.6 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: caught }}
      accessibilityLabel={`${name} caught`}>
      <View
        style={[
          styles.mark,
          caught
            ? { backgroundColor: theme.sign, borderColor: theme.sign }
            : { borderColor: theme.textSecondary },
        ]}>
        {caught ? (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={18}
            tintColor={theme.onSign}
          />
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  target: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // Lines the mark up with the row's right padding
    marginRight: -10,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
