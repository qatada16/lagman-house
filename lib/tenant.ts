import { useAuthStore } from '@/store/authStore';

export function getTenantId(): string | null {
  const p = useAuthStore.getState().profile;
  if (!p) return null;
  return p.role === 'admin' ? p.id : p.admin_id;
}

export function requireTenantId(): string {
  const id = getTenantId();
  if (!id) throw new Error('No tenant for the current user');
  return id;
}

export function useTenantId(): string | null {
  return useAuthStore((s) => (s.profile ? (s.profile.role === 'admin' ? s.profile.id : s.profile.admin_id) : null));
}
