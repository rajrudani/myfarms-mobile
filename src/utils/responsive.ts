/**
 * Responsive Layout & Multi-device utilities for MyFarms app.
 * Supports compact phones, standard phones, large Pro Max devices, foldables, and tablets.
 */

import { useWindowDimensions, Insets, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ResponsiveLayout {
  width: number;
  height: number;
  isSmallPhone: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isWideTablet: boolean;
  isLandscape: boolean;
  containerMaxWidth: number | '100%';
  modalMaxWidth: number | '100%';
  horizontalPadding: number;
  bottomNavPadding: number;
  gridColumns: number;
  safeInsets: { top: number; bottom: number; left: number; right: number };
}

/**
 * Standard touch target hitSlop guaranteeing minimum 44x44dp tap target for icons and buttons.
 */
export const touchTargetHitSlop: Insets = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

/**
 * Hook providing responsive breakpoint values and safe insets.
 */
export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();

  const isSmallPhone = width < 375;
  const isTablet = width >= 768;
  const isWideTablet = width >= 1024;
  const isPhone = !isTablet;
  const isLandscape = width > height;

  // Max width constraints to prevent excessive stretching on tablets
  const containerMaxWidth: number | '100%' = isWideTablet ? 1040 : isTablet ? 840 : '100%';
  const modalMaxWidth: number | '100%' = isTablet ? 600 : '100%';

  const horizontalPadding = isTablet ? 24 : isSmallPhone ? 12 : 16;
  const bottomNavPadding = Math.max(safeInsets.bottom, Platform.OS === 'ios' ? 14 : 8);

  const gridColumns = isWideTablet ? 3 : isTablet ? 2 : 1;

  return {
    width,
    height,
    isSmallPhone,
    isPhone,
    isTablet,
    isWideTablet,
    isLandscape,
    containerMaxWidth,
    modalMaxWidth,
    horizontalPadding,
    bottomNavPadding,
    gridColumns,
    safeInsets,
  };
}

/**
 * Helper to compute adaptive grid item width with specified gaps and container padding.
 */
export function getAdaptiveColumnWidth(
  containerWidth: number,
  columns: number,
  gap: number,
  horizontalPadding: number
): number {
  const totalGaps = (columns - 1) * gap;
  const availableWidth = containerWidth - (horizontalPadding * 2) - totalGaps;
  return Math.floor(availableWidth / columns);
}
