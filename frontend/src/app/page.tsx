'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Gavel, ArrowRight, Zap, Shield, Users, Navigation, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import api from '@/lib/api';

interface Mall {
  id: string;
  name: string;
  city: string;
  imageUrl?: string;
}

interface Product {
  id: string;
  name: string;
  minPrice: string;
  maxPrice: string;
  images: { url: string }[];
  stall: { name: string; mall: { name: string; city: string } };
  category?: { name: string };
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [malls, setMalls] = useState<Mall[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const router = useRouter();

  useEffect(() => {
    api.get('/api/v1/stalls/malls').then((r) => setMalls(r.data)).catch(() => {});
    api.get('/api/v1/products/browse?limit=8&sortBy=popular').then((r) => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/marketplace?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size={36} />
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-navy-600">
            <Link href="/marketplace" className="hover:text-brand-orange transition-colors">Browse</Link>
            <Link href="/demands" className="flex items-center gap-1 hover:text-brand-orange transition-colors"><Gavel className="w-3.5 h-3.5" /> Demands</Link>
            <Link href="/pos" className="hover:text-brand-orange transition-colors">Sell</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-bold text-navy-700 hover:text-brand-blue py-2 px-4 transition-colors">Log In</Link>
            <Link href="/auth/register" className="btn-primary text-sm py-2.5 px-5">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #3B9AE1 0%, transparent 50%), radial-gradient(circle at 80% 50%, #F7941D 0%, transparent 50%)' }} />

        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-white/10">
                <Zap className="w-4 h-4 text-brand-yellow" />
                Live demand-driven marketplace
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-5">
                Find it. <span className="text-brand-orange">Bid on it.</span><br />
                <span className="text-brand-green">Get it delivered.</span>
              </h1>
              <p className="text-lg text-white/70 mb-8 max-w-lg">
                Post what you need. Sellers compete with live offers. Like ride-hailing, but for shopping across Zimbabwe&apos;s markets.
              </p>

              <form onSubmit={handleSearch} className="relative mb-6">
                <div className="bg-white rounded-2xl shadow-2xl p-2 flex items-center gap-2">
                  <div className="flex items-center gap-3 flex-1 pl-4">
                    <div className="w-3 h-3 rounded-full bg-brand-orange" />
                    <input
                      type="text"
                      placeholder="What are you looking for?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full py-3 text-navy-700 placeholder-gray-400 outline-none text-lg font-medium"
                    />
                  </div>
                  <button type="submit" className="bg-brand-orange hover:bg-orange-500 text-white py-3.5 px-8 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                    <Search className="w-5 h-5" /> Search
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/50 text-sm">Trending:</span>
                {['Sneakers', 'iPhone', 'Ankara', 'Bags'].map((tag) => (
                  <Link key={tag} href={`/marketplace?q=${tag}`} className="text-sm text-white/80 bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full transition-colors border border-white/10">
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side — Live demand CTA */}
            <div className="hidden md:block space-y-4">
              <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Live Demands Right Now</div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 text-center">
                <Gavel className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                <div className="text-white font-bold mb-1">Be the first to post a demand</div>
                <div className="text-white/60 text-sm mb-4">Tell sellers what you need and get offers</div>
                <Link href="/demands" className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
                  Post a Demand <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-700 mb-3">Like Uber, but for Shopping</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Post a demand for what you want. Sellers see it and compete to offer you the best price. Pick your favorite offer.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '1', icon: Navigation, title: 'Post Your Demand', desc: 'Tell us what you want — product, size, color, budget. Like requesting a ride.', color: 'bg-blue-50 text-brand-blue border-blue-200' },
              { step: '2', icon: Gavel, title: 'Sellers Compete', desc: 'Nearby sellers see your request and send live offers with their best price.', color: 'bg-orange-50 text-brand-orange border-orange-200' },
              { step: '3', icon: Star, title: 'Pick & Collect', desc: 'Choose the best offer, pay securely through your wallet, and collect your item.', color: 'bg-green-50 text-brand-green border-green-200' },
            ].map((s) => (
              <div key={s.step} className={`rounded-2xl border-2 ${s.color} p-8 relative`}>
                <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-navy-700 text-white flex items-center justify-center font-black text-lg shadow-lg">{s.step}</div>
                <s.icon className="w-10 h-10 mb-4" />
                <h3 className="text-xl font-black text-navy-700 mb-2">{s.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-navy-700">Featured Products</h2>
              <p className="text-gray-500 text-sm mt-1">Browse what&apos;s available across our markets</p>
            </div>
            <Link href="/marketplace" className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <div className="font-semibold">No products yet</div>
              <div className="text-sm mt-1">Products added by sellers will appear here</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((p) => (
                <Link key={p.id} href={`/marketplace?q=${encodeURIComponent(p.name)}`} className="card group cursor-pointer border-2 border-transparent hover:border-brand-orange">
                  <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-3 overflow-hidden relative">
                    {p.images[0] ? (
                      <Image src={p.images[0].url} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 50vw, 25vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Search className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-navy-700 text-sm group-hover:text-brand-orange transition-colors line-clamp-2">{p.name}</h3>
                  <div className="mt-1 text-brand-green font-bold text-sm">${p.minPrice}{p.maxPrice !== p.minPrice ? ` – $${p.maxPrice}` : ''}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.stall?.mall?.name}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Malls */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-navy-700">Our Markets</h2>
              <p className="text-gray-500 text-sm mt-1">Browse stalls across Zimbabwe&apos;s top markets</p>
            </div>
            <Link href="/marketplace" className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2">
              View Map <MapPin className="w-4 h-4" />
            </Link>
          </div>

          {malls.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Imbali Mall', 'Mutize', 'Meikles Market', 'Amaya Mall'].map((name) => (
                <div key={name} className="card border-2 border-transparent">
                  <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-green-50 rounded-xl mb-3 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-brand-orange" />
                  </div>
                  <h3 className="font-bold text-navy-700">{name}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Harare</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {malls.map((m) => (
                <Link key={m.id} href={`/marketplace?mall=${m.id}`} className="card group cursor-pointer border-2 border-transparent hover:border-brand-blue">
                  <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-green-50 rounded-xl mb-3 overflow-hidden relative flex items-center justify-center">
                    {m.imageUrl ? (
                      <Image src={m.imageUrl} alt={m.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 50vw, 25vw" />
                    ) : (
                      <MapPin className="w-8 h-8 text-brand-orange" />
                    )}
                  </div>
                  <h3 className="font-bold text-navy-700 group-hover:text-brand-blue transition-colors">{m.name}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.city}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 bg-navy-700">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '2,500+', label: 'Active Sellers', color: 'text-brand-orange' },
            { num: '4', label: 'Partner Malls', color: 'text-brand-green' },
            { num: '2.5%', label: 'Commission Rate', color: 'text-brand-blue' },
            { num: '4.8/5', label: 'Trust Score Avg', color: 'text-brand-yellow' },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-3xl md:text-4xl font-black ${s.color}`}>{s.num}</div>
              <div className="text-white/60 text-sm font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Dual CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-black text-navy-700 text-center mb-10">Start in 60 Seconds</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-gradient-to-br from-brand-blue to-blue-600 p-8 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black mb-2">I Want to Buy</h3>
              <p className="text-white/80 mb-6">Post what you need. Get offers from sellers. Pick the best deal. Your wallet protects every transaction.</p>
              <Link href="/auth/register" className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold py-3 px-6 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                Start Buying <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-brand-green to-green-700 p-8 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black mb-2">I Want to Sell</h3>
              <p className="text-white/80 mb-6">Free POS system. Manage inventory. Get buyer demands pushed to you. Only 2.5% commission per sale.</p>
              <Link href="/auth/register" className="inline-flex items-center gap-2 bg-white text-brand-green font-bold py-3 px-6 rounded-xl hover:bg-green-50 transition-colors shadow-lg">
                Start Selling <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-navy-700 mb-10">Built on Trust</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'Fraud Detection', desc: 'AI monitors every transaction for anomalies' },
              { icon: Users, title: 'Verified Sellers', desc: 'Field agents verify merchants in person' },
              { icon: Star, title: 'Trust Scores', desc: 'Transparent rating for every user' },
            ].map((f) => (
              <div key={f.title} className="text-center">
                <div className="w-14 h-14 bg-navy-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-navy-700 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <Logo size={32} />
            <p className="text-sm mt-3">Zimbabwe&apos;s demand-driven marketplace. Like ride-hailing, but for shopping.</p>
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
              <div>WhatsApp: +263 71 217 1267</div>
              <div>Calls: +263 77 366 5350</div>
              <div>Email: info@mall263.com</div>
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
