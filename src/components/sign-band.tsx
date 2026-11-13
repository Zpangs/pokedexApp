import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { SignGradient } from '@/constants/theme';

/** A band painted with the red-to-blue sign gradient. Horizontal, so stacked bands line up. */
export function SignBand({ style, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={SignGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={style}
      {...rest}
    />
  );
}
