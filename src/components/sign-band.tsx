import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { SignGradient } from '@/constants/theme';

type Props = ViewProps & {
  style?: StyleProp<ViewStyle>;
  /** Defaults to the app's red-to-blue; Dex screens pass the selected dex's colours. */
  colors?: readonly [string, string];
};

/** A band painted with the sign gradient. Horizontal, so stacked bands line up. */
export function SignBand({ style, colors = SignGradient, ...rest }: Props) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={style} {...rest} />
  );
}
