import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  takePhoto,
  pickImage,
  pickDocument,
  uploadMedia,
  openAttachment,
  UploadCategory,
} from '../utils/media';
import { extractErrorMessage } from '../api/client';
import { useTranslation } from '../i18n/I18nContext';

interface AttachmentPickerProps {
  label?: string;
  category: UploadCategory;
  currentPath?: string | null;
  currentUrl?: string | null;
  onAttachmentChange: (path: string | null, url: string | null) => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  label,
  category,
  currentPath,
  currentUrl,
  onAttachmentChange,
}) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayLabel = label ?? t('Bill / Document Attachment');

  const handlePick = async (mode: 'camera' | 'gallery' | 'document') => {
    try {
      let result;
      if (mode === 'camera') {
        result = await takePhoto();
      } else if (mode === 'gallery') {
        result = await pickImage();
      } else {
        result = await pickDocument();
      }

      if (!result) return;

      setUploading(true);
      setLocalPreview(result.uri);

      // Upload with client-side compressed asset
      const uploaded = await uploadMedia(result.uri, category, result.fileName, result.mimeType);
      onAttachmentChange(uploaded.path, uploaded.url);
    } catch (error) {
      console.error('Failed to attach document/image:', error);
      setLocalPreview(null);
      Alert.alert(t('Upload Failed'), extractErrorMessage(error, t('Could not upload attachment. Please try again.')));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(t('Remove Attachment'), t('Are you sure you want to remove this attached file?'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Remove'),
        style: 'destructive',
        onPress: () => {
          setLocalPreview(null);
          onAttachmentChange(null, null);
        },
      },
    ]);
  };

  const displayUri = localPreview || currentUrl;
  const hasAttachment = Boolean(displayUri || currentPath);
  const isPdf =
    displayUri?.toLowerCase().includes('.pdf') ||
    currentPath?.toLowerCase().includes('.pdf') ||
    displayUri?.toLowerCase().includes('document');

  return (
    <View style={styles.container}>
      {displayLabel ? <Text style={styles.label}>{displayLabel}</Text> : null}

      {uploading ? (
        <View style={styles.uploadingBox}>
          <ActivityIndicator size="small" color="#15803d" />
          <Text style={styles.uploadingText}>{t('Compressing & uploading attachment...')}</Text>
        </View>
      ) : hasAttachment ? (
        <View style={styles.previewCard}>
          {isPdf ? (
            <View style={styles.pdfIconBox}>
              <MaterialCommunityIcons name="file-pdf-box" size={32} color="#dc2626" />
            </View>
          ) : displayUri ? (
            <Image source={{ uri: displayUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderIconBox}>
              <MaterialCommunityIcons name="file-document-outline" size={32} color="#15803d" />
            </View>
          )}

          <TouchableOpacity
            style={styles.previewInfo}
            onPress={() => openAttachment(currentUrl || displayUri)}
            activeOpacity={0.7}
          >
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons
                name={isPdf ? 'file-pdf-box' : 'check-circle'}
                size={14}
                color={isPdf ? '#dc2626' : '#15803d'}
              />
              <Text style={[styles.badgeText, isPdf && { color: '#dc2626' }]}>
                {isPdf ? 'PDF Document' : t('Attached')}
              </Text>
            </View>
            <Text style={styles.filenameText} numberOfLines={1}>
              {currentPath ? currentPath.split('/').pop() : isPdf ? 'document.pdf' : 'Photo attached'}
            </Text>
            <Text style={styles.tapToViewText}>{t('Tap to view')}</Text>
          </TouchableOpacity>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => openAttachment(currentUrl || displayUri)}
              activeOpacity={0.7}
              accessibilityLabel="View document"
            >
              <MaterialCommunityIcons name="eye-outline" size={18} color="#2563eb" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              activeOpacity={0.7}
              accessibilityLabel="Remove document"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePick('camera')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={18} color="#15803d" />
            <Text style={styles.actionButtonText}>{t('Camera')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePick('gallery')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="image" size={18} color="#15803d" />
            <Text style={styles.actionButtonText}>{t('Photos')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.documentButton]}
            onPress={() => handlePick('document')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="file-document-outline" size={18} color="#2563eb" />
            <Text style={[styles.actionButtonText, { color: '#2563eb' }]}>{t('PDF / Doc')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  documentButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  uploadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  pdfIconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  filenameText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  tapToViewText: {
    fontSize: 11,
    color: '#2563eb',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewButton: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
});
