import { User } from '../types';

export function getUserRoles(user: User | null): string[] {
  if (!user) return [];
  if (user.user_type === 'farm_group' || user.user_type === 'admin') {
    return ['Owner'];
  }
  if (!user.roles || !Array.isArray(user.roles)) return [];
  return user.roles.map((r: any) => {
    if (typeof r === 'string') return r;
    return r.value || r.name || '';
  });
}

export function isOwner(user: User | null): boolean {
  if (!user) return false;
  if (user.user_type === 'farm_group' || user.user_type === 'admin') return true;
  return getUserRoles(user).some((r) => r.toLowerCase() === 'owner');
}

export function isManager(user: User | null): boolean {
  if (!user) return false;
  return getUserRoles(user).some((r) => r.toLowerCase() === 'manager');
}

export function isWorker(user: User | null): boolean {
  if (!user) return false;
  if (isOwner(user) || isManager(user)) return false;
  return getUserRoles(user).some((r) => r.toLowerCase() === 'worker');
}

export function isConsultant(user: User | null): boolean {
  if (!user) return false;
  if (isOwner(user) || isManager(user)) return false;
  return getUserRoles(user).some((r) => r.toLowerCase() === 'consultant');
}

export function isOwnerOrManager(user: User | null): boolean {
  return isOwner(user) || isManager(user);
}

/**
 * Access Control Rules matching PWA Filament Policies
 */
export const permissions = {
  // Financial summaries, wage totals, and profit metrics
  canViewFinancials(user: User | null): boolean {
    return isOwnerOrManager(user);
  },

  // Staff roster management, adding staff, recording wages, settlements
  canManageStaff(user: User | null): boolean {
    return isOwnerOrManager(user);
  },

  // Danger zones: deleting farms, deactivating staff
  canAccessDangerZone(user: User | null): boolean {
    return isOwner(user);
  },

  // Creating / editing farms
  canManageFarms(user: User | null): boolean {
    return isOwnerOrManager(user);
  },

  // Commercial transactions: Sales, Agro Shop purchases
  canManageCommercials(user: User | null): boolean {
    return isOwnerOrManager(user);
  },

  // Consultant observations
  canLogConsultantVisit(user: User | null): boolean {
    return isOwnerOrManager(user) || isConsultant(user);
  },

  // Checking if a user can access a specific farm
  canAccessFarm(user: User | null, farmId?: string | number): boolean {
    if (!user) return false;
    if (isOwner(user)) return true; // Owners have global access across all farms
    if (!farmId) return true;
    const numericFarmId = typeof farmId === 'string' ? parseInt(farmId, 10) : farmId;
    if (user.assigned_farm_ids && user.assigned_farm_ids.length > 0) {
      return user.assigned_farm_ids.includes(numericFarmId);
    }
    return isOwnerOrManager(user);
  },
};
