import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Sign-black bar with the yellow sign color marking the current tab
  return (
    <NativeTabs
      backgroundColor={colors.panel}
      indicatorColor={colors.sign}
      iconColor={{ default: colors.onPanelSecondary, selected: colors.onSign }}
      labelStyle={{
        default: { color: colors.onPanelSecondary },
        selected: { color: colors.onPanel },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Dex</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
