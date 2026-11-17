import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/teams/parts';
import { Font, Spacing } from '@/constants/theme';
import {
  cancelDownload,
  deletePack,
  downloadPack,
  type Pack,
  useOfflineImages,
} from '@/db/offline-images';
import { useTheme } from '@/hooks/use-theme';

const PACKS: Record<Pack, { title: string; detail: string; estimate: string }> = {
  small: {
    title: 'Sprites and item icons',
    detail: 'The small pictures in every list, team and the damage calc.',
    estimate: 'About 16 MB',
  },
  artwork: {
    title: 'Official artwork',
    detail: 'The large picture at the top of each Pokémon’s page.',
    estimate: 'About 160 MB, best over Wi-Fi',
  },
};

function megabytes(bytes: number) {
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** One image pack in Settings: what it holds, its size, and download / stop / delete. */
export function OfflinePack({ pack }: { pack: Pack }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { saved, progress } = useOfflineImages();
  const info = PACKS[pack];
  const installed = saved[pack];
  const running = progress?.pack === pack ? progress : null;
  const busyElsewhere = progress !== null && !running;

  let status: string;
  if (running) {
    status = `Downloading ${running.done.toLocaleString()} of ${running.total.toLocaleString()}…`;
  } else if (installed) {
    status = `On this phone · ${megabytes(installed.bytes)}`;
  } else {
    status = info.estimate;
  }

  const confirmDelete = () =>
    Alert.alert(`Delete ${info.title.toLowerCase()}?`, 'They’ll load from the internet again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePack(pack) },
    ]);

  return (
    <View style={[styles.pack, { borderColor: theme.rule }]}>
      <Text style={[styles.title, { color: theme.text }]}>{info.title}</Text>
      <Text style={[styles.note, { color: theme.textSecondary }]}>{info.detail}</Text>
      <Text
        style={[styles.status, { color: theme.text }]}
        accessibilityLiveRegion={running ? 'polite' : 'none'}>
        {status}
      </Text>

      {running ? (
        <View
          style={[styles.track, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: running.total, now: running.done }}>
          <View
            style={[
              styles.fill,
              { width: `${(running.done / Math.max(1, running.total)) * 100}%`, backgroundColor: theme.text },
            ]}
          />
        </View>
      ) : null}

      {installed && installed.missing.length > 0 && !running ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          {installed.missing.length.toLocaleString()} have no image upstream or couldn’t be
          downloaded; those still load from the internet.
        </Text>
      ) : null}

      {running ? (
        <ActionButton label="Stop" onPress={cancelDownload} accessibilityHint="Downloaded images are kept, so it resumes later" />
      ) : busyElsewhere ? null : installed ? (
        <View style={styles.buttons}>
          <ActionButton
            label="Update"
            icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            onPress={() => downloadPack(db, pack)}
            accessibilityHint="Fetches any images still missing"
            style={styles.button}
          />
          <ActionButton label="Delete" destructive onPress={confirmDelete} style={styles.button} />
        </View>
      ) : (
        <ActionButton
          label="Download"
          primary
          icon={{ ios: 'arrow.down.circle', android: 'download', web: 'download' }}
          onPress={() => downloadPack(db, pack)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pack: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  note: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  status: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
