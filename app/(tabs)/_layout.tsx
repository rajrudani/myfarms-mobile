import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, typography } from '../../src/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.slate200,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 8,
          ...shadows.medium,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="farm"
        options={{
          title: 'Farm',
          tabBarLabel: 'Farm Hub',
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
          tabBarLabel: 'Cockpit',
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
          tabBarLabel: 'Registry',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'apps' : 'apps-outline'}
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
