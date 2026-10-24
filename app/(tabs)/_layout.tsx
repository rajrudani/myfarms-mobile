import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, typography } from '../../src/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="farm"
        options={{
          title: 'Farm',
          tabBarLabel: 'Farm',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: 'Staff',
          tabBarLabel: 'Staff',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.centerTabIconContainer,
                focused && styles.centerTabIconContainerActive,
              ]}
            >
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                color={focused ? colors.white : color}
                size={22}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarLabel: 'Notes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'clipboard' : 'clipboard-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="crop-cycles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerTabIconContainer: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  centerTabIconContainerActive: {
    backgroundColor: colors.primary,
    ...shadows.glowPrimary,
  },
});
