import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Sign-panel bar with the red sign accent marking the current tab
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
        <NativeTabs.Trigger.Icon sf="list.number" md="format_list_numbered" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="moves">
        <NativeTabs.Trigger.Label>Moves</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bolt.fill" md="bolt" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="abilities">
        <NativeTabs.Trigger.Label>Abilities</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
