import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { I18nProvider } from '../src/i18n/I18nContext';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { PWABottomNav } from '../src/components/PWABottomNav';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../src/utils/notifications';
import { setupDeepLinking, handleDeepLink } from '../src/utils/deepLinking';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <I18nProvider>
        <RootLayoutNav />
      </I18nProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Redirect to login if not authenticated
        router.replace('/(auth)/login');
      } else {
        // Redirect to tabs if authenticated
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      // Register device push token with backend
      registerForPushNotificationsAsync();

      // Listen for notification tap responses
      const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.url) {
          handleDeepLink(data.url as string);
        } else if (data?.crop_cycle_id) {
          router.push({
            pathname: '/crop-cycle-view',
            params: { id: String(data.crop_cycle_id) },
          });
        } else if (data?.farm_id) {
          router.push({
            pathname: '/farm-view',
            params: { id: String(data.farm_id) },
          });
        }
      });

      // Handle deep linking custom schemes (e.g. myfarmsapp://)
      const cleanupLinking = setupDeepLinking();

      return () => {
        responseSub.remove();
        cleanupLinking();
      };
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <OfflineBanner />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
        <PWABottomNav />
      </View>
    </ThemeProvider>
  );
}

