import { Alert } from 'react-native';
import apiClient from '../api/client';
import { UploadResponse } from '../types';

export type UploadCategory =
  | 'sale-bills'
  | 'agro-shop-bills'
  | 'consultant-visit-recommendations'
  | 'note-reminders'
  | 'farm-staff-photos';

export interface PickedMediaResult {
  uri: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Safely load expo-image-picker module without crashing on startup
 * if the native module is not linked in the current environment.
 */
function getImagePickerModule(): typeof import('expo-image-picker') | null {
  try {
    // Dynamic require prevents top-level bundle crash
    return require('expo-image-picker');
  } catch (err) {
    console.warn("Native module 'ExponentImagePicker' is not available in the current runtime:", err);
    return null;
  }
}

/**
 * Request camera permissions and capture a compressed photo.
 */
export async function takePhoto(): Promise<PickedMediaResult | null> {
  const ImagePicker = getImagePickerModule();
  if (!ImagePicker) {
    Alert.alert(
      'Native Module Required',
      'The camera module (ExponentImagePicker) is not linked in this app build. Please rebuild the app natively using "npx expo run:ios" or "npx expo run:android".'
    );
    return null;
  }

  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in your device settings to take photos of bills and field observations.'
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7, // Client-side JPEG compression to conserve bandwidth
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (err: any) {
    console.error('Camera error:', err);
    Alert.alert('Camera Error', err?.message || 'Failed to capture photo.');
    return null;
  }
}

/**
 * Request photo library permissions and pick a compressed image.
 */
export async function pickImage(): Promise<PickedMediaResult | null> {
  const ImagePicker = getImagePickerModule();
  if (!ImagePicker) {
    Alert.alert(
      'Native Module Required',
      'The photo picker module (ExponentImagePicker) is not linked in this app build. Please rebuild the app natively using "npx expo run:ios" or "npx expo run:android".'
    );
    return null;
  }

  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please allow photo library access in your device settings to select bill or receipt photos.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7, // Client-side JPEG compression to conserve bandwidth
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      fileName: asset.fileName || `image_${Date.now()}.jpg`,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (err: any) {
    console.error('Photo picker error:', err);
    Alert.alert('Picker Error', err?.message || 'Failed to select photo.');
    return null;
  }
}

/**
 * Upload a local image asset to the server via the multi-tenant upload endpoint.
 */
export async function uploadMedia(
  uri: string,
  type: UploadCategory,
  fileName?: string,
  mimeType?: string
): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const name = fileName || `attachment_${Date.now()}.${ext}`;
  const computedMime = mimeType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

  formData.append('file', {
    uri,
    name,
    type: computedMime,
  } as any);
  formData.append('type', type);

  const response = await apiClient.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 30000,
  });

  return {
    path: response.data.data.path,
    url: response.data.data.url,
  };
}
