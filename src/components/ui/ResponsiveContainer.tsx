import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useResponsive } from '../../utils/responsive';
import { colors } from '../../theme/tokens';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional custom max width constraint (default is responsive: 840 on tablet, 1040 on wide tablet) */
  maxWidth?: number;
  /** Whether to apply horizontal padding adaptively (true by default) */
  padded?: boolean;
}

/**
 * ResponsiveContainer
 * Centers child content horizontally on large displays (tablets/foldables)
 * to keep reading lines and touch targets ergonomically proportioned.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  maxWidth,
  padded = false,
}) => {
  const { isTablet, isWideTablet, isSmallPhone } = useResponsive();

  const effectiveMaxWidth =
    maxWidth !== undefined
      ? maxWidth
      : isWideTablet
      ? 1040
      : isTablet
      ? 840
      : '100%';

  const paddingHorizontal = padded
    ? isSmallPhone
      ? 12
      : isTablet
      ? 24
      : 16
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: effectiveMaxWidth,
          paddingHorizontal,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
});
