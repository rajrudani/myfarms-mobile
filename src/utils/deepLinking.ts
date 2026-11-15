import * as Linking from 'expo-linking';
import { router } from 'expo-router';

/**
 * Handle incoming deep link URLs and route them to corresponding app screens.
 * Supports URLs like:
 * - myfarmsapp://crop-cycle/123
 * - myfarmsapp://farm/456
 * - myfarmsapp://sale/789
 * - myfarmsapp://reports?type=attendance
 * - myfarmsapp://notes
 */
export function handleDeepLink(url: string | null): void {
  if (!url) return;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ? parsed.path.replace(/^\/+|\/+$/g, '') : '';
    const queryParams = parsed.queryParams || {};

    const parts = path.split('/');
    const segment = parts[0]?.toLowerCase();
    const resourceId = parts[1] || queryParams.id;

    if (segment === 'crop-cycle' || segment === 'crop-cycles') {
      if (resourceId) {
        router.push({
          pathname: '/crop-cycle-view',
          params: { id: String(resourceId) },
        });
      } else {
        router.push('/(tabs)/crop-cycles');
      }
      return;
    }

    if (segment === 'farm' || segment === 'farms') {
      if (resourceId) {
        router.push({
          pathname: '/farm-view',
          params: { id: String(resourceId) },
        });
      } else {
        router.push('/(tabs)/farm');
      }
      return;
    }

    if (segment === 'sale' || segment === 'sales') {
      if (resourceId) {
        router.push({
          pathname: '/sale-view',
          params: { id: String(resourceId) },
        });
      } else {
        router.push('/sales');
      }
      return;
    }

    if (segment === 'reports' || segment === 'report') {
      router.push('/reports');
      return;
    }

    if (segment === 'notes' || segment === 'reminders') {
      router.push('/(tabs)/notes');
      return;
    }

    if (segment === 'expenses' || segment === 'expense') {
      router.push('/(tabs)/expenses');
      return;
    }

    if (segment === 'staff') {
      router.push('/(tabs)/staff');
      return;
    }

    if (segment === 'agro-shop') {
      router.push('/agro-shop');
      return;
    }
  } catch (err) {
    console.warn('Failed to parse and route deep link:', url, err);
  }
}

/**
 * Initialize deep linking listeners on app launch.
 */
export function setupDeepLinking(): () => void {
  // Handle cold start URL
  Linking.getInitialURL().then((url) => {
    if (url) {
      setTimeout(() => handleDeepLink(url), 600);
    }
  });

  // Handle runtime incoming links
  const subscription = Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });

  return () => {
    subscription.remove();
  };
}
