'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel, LogOut, User, MapPin } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';
import LocationFilterBar from '@/components/home/LocationFilterBar';
import CategoryGrid from '@/components/home/CategoryGrid';
import BannerCarousel from '@/components/home/BannerCarousel';
import DemandCTA from '@/components/home/DemandCTA';
import InfiniteProductFeed from '@/components/home/InfiniteProductFeed';

export default function HomePage() {
  const [selectedMallId, setSelectedMallId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  // Close account dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-6">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size={36} />
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-navy-600">
            {user?.role === 'FIELD_AGENT' && (
              <Link href="/agent" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
                <MapPin className="w-3.5 h-3.5" /> Agent
              </Link>
            )}
            <Link href="/marketplace" className="hover:text-brand-orange transition-colors">Browse</Link>
            <Link href="/for-you" className="hover:text-brand-orange transition-colors">For You</Link>
            <Link href="/services" className="hover:text-brand-orange transition-colors">Services</Link>
            <Link href="/demands" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
              <Gavel className="w-3.5 h-3.5" /> Demands
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-50 transition-colors"
                >
                  {user.avatarUrl ? (
                    <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                      <Image src={user.avatarUrl} alt="" fill className="object-cover" sizes="36px" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-bold text-navy-700">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-gray-500 capitalize">{user.role.replace(/_/g, ' ').toLowerCase()}</div>
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-navy-700 hover:bg-gray-50 transition-colors rounded-t-2xl"
                    >
                      <User className="w-4 h-4" /> My Dashboard
                    </Link>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-red hover:bg-red-50 transition-colors rounded-b-2xl"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm font-bold text-navy-700 hover:text-brand-blue py-2 px-4 transition-colors">
                  Log In
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm py-2.5 px-5">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Alibaba/FB Marketplace Layout */}
      <LocationFilterBar selectedMallId={selectedMallId} onSelectMall={setSelectedMallId} />
      <CategoryGrid selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} />
      {(selectedMallId || selectedCategoryId) && (
        <div className="max-w-7xl mx-auto px-4 pb-2 -mt-1">
          <Link
            href={`/marketplace?${new URLSearchParams({
              ...(selectedMallId ? { mallId: selectedMallId } : {}),
              ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
            }).toString()}`}
            className="inline-flex text-sm font-bold text-brand-blue hover:underline"
          >
            Open same filters in Browse (full grid) →
          </Link>
        </div>
      )}
      <BannerCarousel />
      <DemandCTA />
      <InfiniteProductFeed mallId={selectedMallId} categoryId={selectedCategoryId} />

      {/* Footer */}
      <footer className="bg-navy-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <Logo size={32} />
            <p className="text-sm mt-3">Zimbabwe&apos;s marketplace connecting buyers with sellers across the country.</p>
          </div>
          <div>
            <div className="font-bold text-white mb-3 text-sm">Platform</div>
            <div className="space-y-2 text-sm">
              <div><Link href="/marketplace" className="hover:text-white transition-colors">Browse Products</Link></div>
              <div><Link href="/demands" className="hover:text-white transition-colors">Post a Demand</Link></div>
              <div><Link href="/pos" className="hover:text-white transition-colors">POS for Sellers</Link></div>
            </div>
          </div>
          <div>
            <div className="font-bold text-white mb-3 text-sm">Support</div>
            <div className="space-y-2 text-sm">
              <div><Link href="#" className="hover:text-white transition-colors">Help Center</Link></div>
              <div><Link href="#" className="hover:text-white transition-colors">Contact Us</Link></div>
              <div><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></div>
            </div>
          </div>
          <div>
            <div className="font-bold text-white mb-3 text-sm">Connect</div>
            <div className="space-y-2 text-sm">
              <div>Web: www.mall263.com</div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-navy-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Mall263. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
