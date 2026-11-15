import { offlineCache } from './offlineCache';
import apiClient, { onNetworkStatusChange } from '../api/client';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data?: any;
  description: string;
  createdAt: number;
}

const QUEUE_CACHE_KEY = 'offline_mutations_queue';

// In-memory queue change listeners
type QueueListener = (count: number) => void;
const queueListeners = new Set<QueueListener>();

function notifyQueueChange(count: number) {
  queueListeners.forEach((listener) => {
    try {
      listener(count);
    } catch (e) {
      console.warn('Error in queue listener:', e);
    }
  });
}

export const onQueueChange = (listener: QueueListener) => {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
};

export const offlineSync = {
  /**
   * Get all currently queued mutations.
   */
  async getQueue(): Promise<QueuedMutation[]> {
    const list = await offlineCache.get<QueuedMutation[]>(QUEUE_CACHE_KEY);
    return list || [];
  },

  /**
   * Add a new mutation to the offline outbox queue.
   */
  async enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt'>
  ): Promise<QueuedMutation> {
    const currentQueue = await this.getQueue();
    const newEntry: QueuedMutation = {
      ...mutation,
      id: `mutation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };

    const updatedQueue = [...currentQueue, newEntry];
    await offlineCache.set(QUEUE_CACHE_KEY, updatedQueue);
    notifyQueueChange(updatedQueue.length);
    return newEntry;
  },

  /**
   * Remove a processed mutation from the queue.
   */
  async remove(id: string): Promise<void> {
    const currentQueue = await this.getQueue();
    const updatedQueue = currentQueue.filter((item) => item.id !== id);
    await offlineCache.set(QUEUE_CACHE_KEY, updatedQueue);
    notifyQueueChange(updatedQueue.length);
  },

  /**
   * Process all pending mutations in FIFO order.
   */
  async flush(): Promise<{ synced: number; failed: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        if (item.method === 'POST') {
          await apiClient.post(item.endpoint, item.data);
        } else if (item.method === 'PUT') {
          await apiClient.put(item.endpoint, item.data);
        } else if (item.method === 'DELETE') {
          await apiClient.delete(item.endpoint);
        }
        await this.remove(item.id);
        synced++;
      } catch (error: any) {
        // If still network error, pause flush until connection improves
        if (error.message === 'Network Error' || !error.response) {
          failed++;
          break;
        }

        // Permanent client error (422, 404, etc.) - remove to prevent blocking queue
        console.warn(`Mutation ${item.id} failed with server response:`, error);
        await this.remove(item.id);
        failed++;
      }
    }

    return { synced, failed };
  },
};

// Automatically flush pending offline mutations when connection returns
onNetworkStatusChange(async (isOnline) => {
  if (isOnline) {
    const count = (await offlineSync.getQueue()).length;
    if (count > 0) {
      console.log(`[OfflineSync] Connection restored. Flushing ${count} pending actions...`);
      await offlineSync.flush();
    }
  }
});
