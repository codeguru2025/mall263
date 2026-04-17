import { useQuery } from '@tanstack/react-query';
import api from './api';
import { useAuthStore } from './store';

export function useSubscription() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/api/v1/subscriptions/status').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000, // re-fetch at most every minute
  });

  return {
    status: data?.status as string | undefined,
    trialActive: data?.trialActive ?? true,
    isActive: data?.isActive ?? false,
    // Default true while loading (don't flash gates).
    // On network error also default to true — a transient API failure must never lock out
    // a trial or paying user. The backend enforces state at the API level anyway.
    fullyAccess: isLoading ? true : isError ? true : (data?.fullyAccess ?? true),
    hasEcocash: data?.hasEcocash ?? false,
    ecocashNumber: data?.ecocashNumber as string | undefined,
    trialEndsAt: data?.trialEndsAt ? new Date(data.trialEndsAt) : undefined,
    isLoading,
    refetch,
  };
}
