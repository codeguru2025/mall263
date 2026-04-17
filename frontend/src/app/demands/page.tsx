'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { 
  ArrowLeft, Gavel, Clock, ChevronRight, Zap, PlusCircle, 
  TrendingUp, AlertCircle, MapPin, Flame, Target, MessageCircle
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import DemandCard from '@/components/DemandCard';
import UrgencyCountdown from '@/components/UrgencyCountdown';

export default function DemandsPage() {
  // Default to full open list so sellers always see every live demand; ranked/urgent are optional views.
  const [tab, setTab] = useState<'ranked' | 'open' | 'my' | 'urgent'>('open');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  const { data: chatRooms = [] } = useQuery<any[]>({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/api/v1/chat/rooms').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  const unreadChatCount = chatRooms.reduce((count, room) => {
    const senderId = room?.messages?.[0]?.sender?.id as string | undefined;
    return senderId && senderId !== user?.id ? count + 1 : count;
  }, 0);

  // Get user location for distance-based ranking
  useEffect(() => {
    if (navigator.geolocation && isSeller) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log('Location access denied'),
        { timeout: 10000 }
      );
    }
  }, [isSeller]);

  const { data: rankedDemands, isLoading: rankedLoading } = useQuery({
    queryKey: ['demands-ranked', userLocation],
    queryFn: () => api.get('/api/v1/demands/ranked', { 
      params: { 
        limit: 20,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        maxDistance: 50,
      } 
    }).then((r) => r.data),
    enabled: tab === 'ranked',
  });

  const { data: urgentDemands, isLoading: urgentLoading } = useQuery({
    queryKey: ['demands-urgent'],
    queryFn: () => api.get('/api/v1/demands/urgent', { params: { limit: 10 } }).then((r) => r.data),
    enabled: tab === 'urgent',
  });

  const { data: openDemands, isLoading: openLoading } = useQuery({
    queryKey: ['demands-open'],
    queryFn: () => api.get('/api/v1/demands/open', { params: { limit: 20 } }).then((r) => r.data),
    enabled: tab === 'open',
  });

  const { data: myDemands, isLoading: myLoading } = useQuery({
    queryKey: ['demands-my'],
    queryFn: () => api.get('/api/v1/demands/my', { params: { limit: 20 } }).then((r) => r.data),
    enabled: tab === 'my' && isAuthenticated,
  });

  const isLoading = rankedLoading || urgentLoading || openLoading || myLoading;
  const currentDemands = tab === 'ranked' ? rankedDemands 
    : tab === 'urgent' ? { data: urgentDemands }
    : tab === 'my' ? { data: myDemands }
    : openDemands;

  const demandsList = currentDemands?.data || currentDemands || [];

  const tabs = [
    { 
      id: 'ranked' as const, 
      label: 'Smart Ranked', 
      icon: TrendingUp,
      show: isSeller,
      color: 'bg-brand-green',
    },
    { 
      id: 'urgent' as const, 
      label: 'Expiring Soon', 
      icon: Flame,
      show: isSeller,
      color: 'bg-brand-red',
    },
    { 
      id: 'open' as const, 
      label: 'All Demands', 
      icon: Zap,
      show: true,
      color: 'bg-brand-orange',
    },
    { 
      id: 'my' as const, 
      label: 'My Demands', 
      icon: Target,
      show: !isSeller && isAuthenticated,
      color: 'bg-brand-blue',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex-shrink-0">
                <Logo size={30} />
              </Link>
              <div className="hidden sm:block">
                <h1 className="text-lg font-black text-navy-700">Demand Board</h1>
                <p className="text-xs text-gray-500">Find opportunities ranked by urgency & trust</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <Link
                  href="/chat"
                  className="text-sm py-2.5 px-4 rounded-xl border-2 border-gray-100 text-navy-700 font-bold hover:border-gray-200 transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> Chats
                  {unreadChatCount > 0 ? (
                    <span className="inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-brand-orange text-white text-[10px] leading-none">
                      {unreadChatCount}
                    </span>
                  ) : null}
                </Link>
              )}
              {!isSeller && (
                <Link
                  href="/demands/new"
                  className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Post Demand
                </Link>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.filter(t => t.show).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`
                  flex-shrink-0 py-2.5 px-4 rounded-xl text-sm font-bold transition-all
                  flex items-center gap-2 whitespace-nowrap
                  ${tab === t.id 
                    ? `${t.color} text-white shadow-md` 
                    : 'bg-white text-navy-600 border-2 border-gray-100 hover:border-gray-200'
                  }
                `}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5 pb-24 sm:pb-6">
        {/* Info banner for sellers */}
        {isSeller && tab === 'ranked' && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 mb-6 border border-green-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-green rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-navy-700">Smart Ranking Algorithm</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Demands are ranked by: <span className="font-semibold text-brand-orange">Urgency</span> + 
                  <span className="font-semibold text-brand-blue">Time Remaining</span> + 
                  <span className="font-semibold text-brand-green">Buyer Trust</span> + 
                  <span className="font-semibold text-purple-600">Budget</span>
                </p>
                {userLocation && (
                  <p className="text-xs text-brand-green mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Location-based filtering active
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Urgent banner */}
        {isSeller && tab === 'urgent' && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 mb-6 border border-red-100">
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-brand-red" />
              <div>
                <h3 className="font-bold text-navy-700">Expiring in &lt; 6 Hours</h3>
                <p className="text-sm text-gray-600">
                  These demands need immediate attention. Fast response = higher win rate!
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border border-gray-100 h-64">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-gray-200 rounded-lg h-5 w-16" />
                  <div className="bg-gray-200 rounded-lg h-5 w-20" />
                </div>
                <div className="bg-gray-200 rounded-lg h-4 w-full mb-2" />
                <div className="bg-gray-200 rounded-lg h-4 w-3/4 mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-200 rounded-xl h-14" />
                  <div className="bg-gray-200 rounded-xl h-14" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demandsList.map((demand: any) => (
                <DemandCard
                  key={demand.id}
                  demand={{
                    ...demand,
                    maxBudget: String(demand.maxBudget),
                    minBudget: demand.minBudget ? String(demand.minBudget) : null,
                  }}
                  showRank={tab === 'ranked'}
                  showScore={tab === 'ranked'}
                  priority={demand.urgency === 'URGENT' || demand.rank <= 3}
                />
              ))}
            </div>

            {demandsList.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gavel className="w-10 h-10 text-brand-orange" />
                </div>
                <h3 className="text-xl font-black text-navy-700 mb-2">No demands found</h3>
                <p className="text-gray-500 mb-6">
                  {tab === 'ranked' 
                    ? 'No matching demands in your area. Try the "All Demands" tab.'
                    : tab === 'urgent'
                    ? 'No urgent demands right now. Check back soon!'
                    : 'Be the first to post what you need.'
                  }
                </p>
                {!isSeller && (
                  <Link href="/demands/new" className="btn-primary">
                    Post Your First Demand
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
