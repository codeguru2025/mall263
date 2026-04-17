import { api } from '@/lib/api';

/** Shape of `GET /api/v1/users/me` (passwordHash stripped server-side). */
export type MeProfile = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  phoneVerified?: boolean;
  wallet?: {
    availableBalance: unknown;
    lockedBalance: unknown;
    currency: string;
  } | null;
  trustScore?: { overallScore: unknown } | null;
  merchant?: { id: string; businessName: string; status: string } | null;
  /** Active stall assignments (attendants). Matches Prisma `User.attendantStall`. */
  attendantStall?: Array<{
    stall: { id: string; name: string; stallNumber?: string | null; merchantId: string };
  }>;
};

export async function fetchMeProfile(): Promise<MeProfile> {
  const { data } = await api.get<MeProfile>('/api/v1/users/me');
  return data;
}

export async function patchMeProfile(body: {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}): Promise<MeProfile> {
  const { data } = await api.patch<MeProfile>('/api/v1/users/me', body);
  return data;
}
