import { Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { getBaseUrl, getApiLocale } from '../api/client';
import { storage } from '../utils/storage';

export type ReportExportType = 'attendance' | 'payment' | 'activity' | 'expense';
export type ReportExportFormat = 'pdf' | 'xlsx';

export interface ExportReportParams {
  farm_id?: number | string;
  farm_staff_id?: number | string;
  crop_cycle_id?: number | string;
  from_date?: string;
  to_date?: string;
  month?: number;
  year?: number;
}

const MIME_TYPES: Record<ReportExportFormat, { mimeType: string; uti: string }> = {
  pdf: {
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
  },
  xlsx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'org.openxmlformats.spreadsheetml.sheet',
  },
};

/**
 * Build the query string for report export endpoint.
 */
export function buildExportUrl(
  reportType: ReportExportType,
  format: ReportExportFormat,
  params: ExportReportParams
): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.append('type', format);

  if (params.farm_id) searchParams.append('farm_id', String(params.farm_id));
  if (params.farm_staff_id) searchParams.append('farm_staff_id', String(params.farm_staff_id));
  if (params.crop_cycle_id && params.crop_cycle_id !== 'all') {
    searchParams.append('crop_cycle_id', String(params.crop_cycle_id));
  }
  if (params.from_date) searchParams.append('from_date', params.from_date);
  if (params.to_date) searchParams.append('to_date', params.to_date);
  if (params.month) searchParams.append('month', String(params.month));
  if (params.year) searchParams.append('year', String(params.year));

  return `${baseUrl}/reports/${reportType}/export?${searchParams.toString()}`;
}

/**
 * Download report to device cache and present native share sheet (WhatsApp, Email, Files).
 */
export async function downloadAndShareReport(
  reportType: ReportExportType,
  format: ReportExportFormat,
  params: ExportReportParams,
  options?: {
    dialogTitle?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<{ success: boolean; uri?: string }> {
  try {
    const token = await storage.getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Session expired. Please log in again to export reports.');
      return { success: false };
    }

    const exportUrl = buildExportUrl(reportType, format, params);

    // On web, open export URL directly in browser tab
    if (Platform.OS === 'web') {
      window.open(exportUrl, '_blank');
      return { success: true };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportType}_report_${timestamp}.${format}`;
    const destination = new File(Paths.cache, fileName);

    const downloadedFile = await File.downloadFileAsync(exportUrl, destination, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Locale': getApiLocale(),
      },
      idempotent: true,
      onProgress: (event) => {
        if (options?.onProgress && event.totalBytes > 0) {
          options.onProgress(event.bytesWritten / event.totalBytes);
        }
      },
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      // Fallback: open via system browser or viewer
      await WebBrowser.openBrowserAsync(downloadedFile.uri);
      return { success: true, uri: downloadedFile.uri };
    }

    const formatMeta = MIME_TYPES[format];
    await Sharing.shareAsync(downloadedFile.uri, {
      mimeType: formatMeta.mimeType,
      UTI: formatMeta.uti,
      dialogTitle: options?.dialogTitle || `Share ${reportType.toUpperCase()} Report`,
    });

    return { success: true, uri: downloadedFile.uri };
  } catch (error: any) {
    console.error('Failed to export and share report:', error);
    Alert.alert(
      'Export Failed',
      error?.message || 'Could not download or share the report. Please verify connection and try again.'
    );
    return { success: false };
  }
}
