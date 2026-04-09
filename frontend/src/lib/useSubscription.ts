import { useQuery } from '@tanstack/react-query';
import api from './api';
import { useAuthStore } from './store';

export function useSubscription() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/api/v1/subscriptions/status').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000, // re-fetch at most every minute
  });

  return {
    status: data?.status as string | undefined,
    trialActive: data?.trialActive ?? true,
    isActive: data?.isActive ?? false,
    fullyAccess: data?.fullyAccess ?? true, // default true while loading (don't flash gates)
    hasEcocash: data?.hasEcocash ?? false,
    ecocashNumber: data?.ecocashNumber as string | undefined,
    trialEndsAt: data?.trialEndsAt ? new Date(data.trialEndsAt) : undefined,
    isLoading,
    refetch,
  };
}
