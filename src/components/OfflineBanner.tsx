import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onNetworkStatusChange, notifyNetworkStatus, apiClient } from '../api/client';
import { onQueueChange, offlineSync } from '../utils/offlineSync';
import { useTranslation } from '../i18n/I18nContext';

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restored, setRestored] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Check initial queue
    offlineSync.getQueue().then((q) => setPendingCount(q.length));

    const unsubscribeQueue = onQueueChange((count) => {
      setPendingCount(count);
    });

    const unsubscribeNet = onNetworkStatusChange((online) => {
      if (!online) {
        setIsOffline(true);
        setRestored(false);
      } else if (isOffline) {
        setIsOffline(false);
        setRestored(true);
        const timer = setTimeout(() => setRestored(false), 3500);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      unsubscribeQueue();
      unsubscribeNet();
    };
  }, [isOffline]);

  const handleManualCheck = async () => {
    setRetrying(true);
    try {
      await apiClient.get('/me', { timeout: 4000 });
      notifyNetworkStatus(true);
      setIsOffline(false);
      setRestored(true);
      setTimeout(() => setRestored(false), 3000);
    } catch (e: any) {
      if (e.response) {
        notifyNetworkStatus(true);
        setIsOffline(false);
        setRestored(true);
        setTimeout(() => setRestored(false), 3000);
      } else {
        setIsOffline(true);
      }
    } finally {
      setRetrying(false);
    }
  };

  if (restored) {
    return (
      <View style={[styles.banner, styles.restoredBanner]}>
        <Ionicons name="checkmark-circle" size={15} color="#15803d" />
        <Text style={[styles.bannerText, styles.restoredText]}>
          {pendingCount > 0
            ? t('Connection restored - syncing offline records...')
            : t('Connection restored')}
        </Text>
      </View>
    );
  }

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  return (
    <View style={[styles.banner, styles.offlineBanner]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#b45309" />
      <Text style={[styles.bannerText, styles.offlineText]} numberOfLines={1}>
        {pendingCount > 0
          ? `${t('Working Offline')} (${pendingCount} ${t('pending')})`
          : t('Working offline (Using cached data)')}
      </Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={handleManualCheck}
        disabled={retrying}
        activeOpacity={0.7}
      >
        {retrying ? (
          <ActivityIndicator size="small" color="#b45309" />
        ) : (
          <Text style={styles.retryText}>{t('Retry')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 9999,
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  offlineText: {
    color: '#92400e',
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
  },
  restoredBanner: {
    backgroundColor: '#dcfce7',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  restoredText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
  },
  bannerText: {
    fontSize: 12,
  },
  retryBtn: {
    backgroundColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
  },
});
