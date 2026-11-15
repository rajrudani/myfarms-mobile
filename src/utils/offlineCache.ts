import * as FileSystem from 'expo-file-system/legacy';

const CACHE_DIR = `${FileSystem.documentDirectory || ''}myfarms_offline_cache/`;

// Ensure cache directory exists
async function ensureCacheDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

// Convert an endpoint/key into a safe filesystem filename
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
}

export interface CacheRecord<T> {
  data: T;
  timestamp: number;
  key: string;
}

export const offlineCache = {
  /**
   * Save an API response or data object to persistent offline storage.
   */
  async set<T>(key: string, data: T): Promise<void> {
    try {
      if (!FileSystem.documentDirectory) return;
      await ensureCacheDir();
      const filePath = `${CACHE_DIR}${sanitizeKey(key)}`;
      const payload: CacheRecord<T> = {
        data,
        timestamp: Date.now(),
        key,
      };
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to write offline cache for:', key, e);
    }
  },

  /**
   * Read data from persistent offline storage.
   * If maxAgeMs is provided and the cache is older, returns null.
   */
  async get<T>(key: string, maxAgeMs?: number): Promise<T | null> {
    try {
      if (!FileSystem.documentDirectory) return null;
      const filePath = `${CACHE_DIR}${sanitizeKey(key)}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return null;

      const content = await FileSystem.readAsStringAsync(filePath);
      const parsed: CacheRecord<T> = JSON.parse(content);

      if (maxAgeMs && Date.now() - parsed.timestamp > maxAgeMs) {
        return null;
      }

      return parsed.data;
    } catch (e) {
      console.warn('Failed to read offline cache for:', key, e);
      return null;
    }
  },

  /**
   * Remove a single cache entry.
   */
  async remove(key: string): Promise<void> {
    try {
      if (!FileSystem.documentDirectory) return;
      const filePath = `${CACHE_DIR}${sanitizeKey(key)}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (e) {
      console.warn('Failed to delete cache for:', key, e);
    }
  },

  /**
   * Clear all offline cached records.
   */
  async clear(): Promise<void> {
    try {
      if (!FileSystem.documentDirectory) return;
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      }
    } catch (e) {
      console.warn('Failed to clear offline cache:', e);
    }
  },
};
