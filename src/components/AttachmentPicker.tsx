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
import { takePhoto, pickImage, uploadMedia, UploadCategory } from '../utils/media';
import { extractErrorMessage } from '../api/client';

interface AttachmentPickerProps {
  label?: string;
  category: UploadCategory;
  currentPath?: string | null;
  currentUrl?: string | null;
  onAttachmentChange: (path: string | null, url: string | null) => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  label = 'Bill / Document Attachment',
  category,
  currentPath,
  currentUrl,
  onAttachmentChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handlePick = async (fromCamera: boolean) => {
    try {
      const result = fromCamera ? await takePhoto() : await pickImage();
      if (!result) return;

      setUploading(true);
      setLocalPreview(result.uri);

      // Upload with client-side compressed asset
      const uploaded = await uploadMedia(result.uri, category, result.fileName, result.mimeType);
      onAttachmentChange(uploaded.path, uploaded.url);
    } catch (error) {
      console.error('Failed to attach image:', error);
      setLocalPreview(null);
      Alert.alert('Upload Failed', extractErrorMessage(error, 'Could not upload attachment. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove Attachment', 'Are you sure you want to remove this attached file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {uploading ? (
        <View style={styles.uploadingBox}>
          <ActivityIndicator size="small" color="#15803d" />
          <Text style={styles.uploadingText}>Compressing & uploading photo...</Text>
        </View>
      ) : hasAttachment ? (
        <View style={styles.previewCard}>
          {displayUri ? (
            <Image source={{ uri: displayUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderIconBox}>
              <MaterialCommunityIcons name="file-document-outline" size={32} color="#15803d" />
            </View>
          )}

          <View style={styles.previewInfo}>
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons name="check-circle" size={14} color="#15803d" />
              <Text style={styles.badgeText}>Attached</Text>
            </View>
            <Text style={styles.filenameText} numberOfLines={1}>
              {currentPath ? currentPath.split('/').pop() : 'Photo attached'}
            </Text>
          </View>

          <TouchableOpacity style={styles.removeButton} onPress={handleRemove} activeOpacity={0.7}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePick(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={20} color="#15803d" />
            <Text style={styles.actionButtonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePick(false)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="image" size={20} color="#15803d" />
            <Text style={styles.actionButtonText}>Gallery</Text>
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
    gap: 12,
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
    paddingVertical: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
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
    gap: 12,
  },
  previewImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  placeholderIconBox: {
    width: 52,
    height: 52,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  filenameText: {
    fontSize: 12,
    color: '#64748b',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
});
