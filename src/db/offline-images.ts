import { Directory, File, Paths } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * Images saved on the device so lookups work without a connection. Two packs: the small ones
 * every list uses (sprites and item icons, a few MB) and the large official artwork on Pokémon
 * pages (about 160 MB). Files live in the app's documents, which Android never clears on its own,
 * unlike the image cache.
 */
export type Pack = 'small' | 'artwork';

/** Image kinds, each a folder under images/. */
type Kind = 'sprite' | 'item' | 'artwork';

const REMOTE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const REMOTE_PATH: Record<Kind, string> = {
  sprite: 'pokemon',
  item: 'items',
  artwork: 'pokemon/other/official-artwork',
};
const PACK_KINDS: Record<Pack, Kind[]> = { small: ['sprite', 'item'], artwork: ['artwork'] };

const root = new Directory(Paths.document, 'images');
const rootUri = root.uri.replace(/\/$/, '');

export function remoteUrl(kind: Kind, name: string | number) {
  return `${REMOTE}/${REMOTE_PATH[kind]}/${name}.png`;
}

/* ---------- Saved state ---------- */

/** An installed pack, and the images it couldn't get (missing upstream, or a failed request). */
type Installed = { missing: string[]; bytes: number };
type Saved = Partial<Record<Pack, Installed>>;

const KEY = 'offline-images';

function readSaved(): Saved {
  try {
    return JSON.parse(Storage.getItemSync(KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

let saved = readSaved();
/** Per pack, "kind/name" keys to keep loading from the web. */
let missing = toMissingSets(saved);

function toMissingSets(s: Saved) {
  const sets: Partial<Record<Pack, Set<string>>> = {};
  for (const pack of Object.keys(s) as Pack[]) sets[pack] = new Set(s[pack]!.missing);
  return sets;
}

function save(next: Saved) {
  saved = next;
  missing = toMissingSets(next);
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // Kept for this session only
  }
  emit();
}

function packOf(kind: Kind): Pack {
  return kind === 'artwork' ? 'artwork' : 'small';
}

/** The image's on-device copy when its pack is installed, otherwise its web address. */
export function imageUri(kind: Kind, name: string | number) {
  const set = missing[packOf(kind)];
  if (set && !set.has(`${kind}/${name}`)) return `${rootUri}/${kind}/${name}.png`;
  return remoteUrl(kind, name);
}

/* ---------- Downloading ---------- */

export type Progress = { pack: Pack; done: number; total: number; failed: number };

let progress: Progress | null = null;
let cancelled = false;
const listeners = new Set<() => void>();
let snapshot: { saved: Saved; progress: Progress | null } = { saved, progress };

function emit() {
  snapshot = { saved, progress };
  listeners.forEach((l) => l());
}

/** Installed packs and the download in progress, if any. */
export function useOfflineImages() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot
  );
}

async function imageNames(db: SQLiteDatabase, kind: Kind): Promise<string[]> {
  if (kind === 'item') {
    const rows = await db.getAllAsync<{ identifier: string }>('SELECT identifier FROM items');
    return rows.map((r) => r.identifier);
  }
  const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM pokemon ORDER BY id');
  return rows.map((r) => String(r.id));
}

/**
 * Saves one image unless it's already on the device. Returns its size in bytes, or null when it
 * isn't upstream (some forms and items have no image) or the request failed. Never throws, so
 * one bad image can't stop a pack.
 */
async function fetchImage(kind: Kind, name: string): Promise<number | null> {
  const target = new File(root, kind, `${name}.png`);
  try {
    if (target.exists && target.size > 0) return target.size;
    const file = await File.downloadFileAsync(remoteUrl(kind, name), target, { idempotent: true });
    return file.size;
  } catch {
    // Android streams into the target, so a failed download can leave part of a file behind
    try {
      const leftover = new File(root, kind, `${name}.png`);
      if (leftover.exists) leftover.delete();
    } catch {
      // Nothing to clean up
    }
    return null;
  }
}

/**
 * Downloads a pack, skipping images already on the device, so a stopped download picks up where
 * it left off. Keeps the screen on meanwhile: Android pauses the app when it sleeps.
 */
export async function downloadPack(db: SQLiteDatabase, pack: Pack) {
  if (progress) return;
  cancelled = false;

  const jobs: { kind: Kind; name: string }[] = [];
  for (const kind of PACK_KINDS[pack]) {
    new Directory(root, kind).create({ intermediates: true, idempotent: true });
    for (const name of await imageNames(db, kind)) jobs.push({ kind, name });
  }

  progress = { pack, done: 0, total: jobs.length, failed: 0 };
  emit();
  await activateKeepAwakeAsync(KEY).catch(() => {});

  const failed: string[] = [];
  let bytes = 0;
  let next = 0;
  let lastEmit = 0;

  const worker = async () => {
    while (!cancelled && next < jobs.length) {
      const { kind, name } = jobs[next++];
      const size = await fetchImage(kind, name);
      if (size === null) {
        failed.push(`${kind}/${name}`);
        progress!.failed++;
      } else {
        bytes += size;
      }
      progress!.done++;
      // Re-render a few times a second, not once per image
      const now = Date.now();
      if (now - lastEmit > 250) {
        lastEmit = now;
        progress = { ...progress! };
        emit();
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: 8 }, worker));
  } finally {
    deactivateKeepAwake(KEY);
    const finished = !cancelled;
    progress = null;
    // Install only a finished pack; a stopped one stays on the web but keeps its files to resume
    if (finished) save({ ...saved, [pack]: { missing: failed, bytes } });
    else emit();
  }
}

export function cancelDownload() {
  cancelled = true;
}

/** Removes a pack's files; its images load from the web again. */
export function deletePack(pack: Pack) {
  const { [pack]: _removed, ...rest } = saved;
  save(rest);
  for (const kind of PACK_KINDS[pack]) {
    const dir = new Directory(root, kind);
    if (dir.exists) dir.delete();
  }
}
