'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, AlertCircle, Shield, Globe2, Zap, Lock, Users, ArrowRight } from 'lucide-react';
import { Globe } from './Globe';

type SearchMode = 'register' | 'transfer';

interface ValidationError {
  field: string;
  message: string;
}

function validateDomainInput(input: string, mode: SearchMode): ValidationError | null {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { field: 'domain', message: 'Please enter a web space name' };
  }

  if (trimmed.includes(' ')) {
    return { field: 'domain', message: 'Web space names cannot contain spaces' };
  }

  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  if (!domainRegex.test(trimmed)) {
    return { field: 'domain', message: 'Please enter a valid name (letters, numbers, hyphens only)' };
  }

  if (trimmed.includes('--')) {
    return { field: 'domain', message: 'Names cannot contain consecutive hyphens' };
  }

  if (trimmed.length < 2) {
    return { field: 'domain', message: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 63) {
    return { field: 'domain', message: 'Name must be 63 characters or less' };
  }

  return null;
}

const TRUST_SIGNALS = [
  { icon: Shield, label: 'Content-Safe Network' },
  { icon: Lock, label: 'Private by Design' },
  { icon: Zap, label: 'Instant Activation' },
];

const STATS = [
  { value: '40+', label: 'Web Spaces', sublabel: 'Available TLDs' },
  { value: '100%', label: 'Private', sublabel: 'Not on public DNS' },
  { value: '$3', label: 'Per Year', sublabel: 'Simple pricing' },
];

export function DomainSearchHero() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>('register');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value.replace(/\s/g, '').toLowerCase());
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateDomainInput(query, mode);
    if (validation) {
      setError(validation.message);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        query: query.trim().toLowerCase(),
        mode,
      });
      router.push(`/domains/search?${searchParams.toString()}`);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-950">
      {/* Background layers */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />

        {/* Radial gradient overlays */}
        <div className="absolute top-0 left-1/4 w-[1000px] h-[1000px] bg-gradient-radial from-jubilee-900/30 via-jubilee-950/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-indigo-900/20 to-transparent rounded-full blur-3xl" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundSize: '60px 60px',
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
          }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left column - Content */}
          <div className="order-2 lg:order-1 z-10">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-jubilee-500/10 border border-jubilee-500/20 rounded-full text-sm font-medium text-jubilee-300 mb-8 backdrop-blur-sm">
              <Globe2 className="h-4 w-4" />
              <span>The Worldwide Bible Web</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              <span className="text-white">Build on a</span>
              <br />
              <span className="bg-gradient-to-r from-jubilee-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                foundation of trust
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-xl mb-10">
              Inspire Web Spaces are private digital addresses that exist exclusively within the Worldwide Bible Web—a protected network accessible only through Jubilee Browser.
            </p>

            {/* Search Module */}
            <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-1.5 max-w-xl shadow-2xl shadow-black/20">
              {/* Tabs */}
              <div className="flex bg-white/[0.03] rounded-xl mb-3">
                <button
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-3 text-center font-medium text-sm transition-all rounded-lg ${
                    mode === 'register'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register New
                </button>
                <button
                  onClick={() => {
                    setMode('transfer');
                    setError(null);
                  }}
                  className={`flex-1 py-3 text-center font-medium text-sm transition-all rounded-lg ${
                    mode === 'transfer'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSubmit} className="p-1">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className={`flex items-center w-full bg-white/5 border rounded-xl transition-all ${
                      error
                        ? 'border-red-500/50 focus-within:border-red-400'
                        : 'border-white/10 focus-within:border-jubilee-400 focus-within:bg-white/[0.08]'
                    }`}>
                      <span className="pl-4 pr-1 text-sm text-jubilee-400 font-mono font-semibold select-none whitespace-nowrap">
                        inspire://
                      </span>
                      <input
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'register' ? 'yourchurch.church' : 'ministry.ministry'}
                        className="flex-1 py-4 pr-4 text-base bg-transparent focus:ring-0 focus:outline-none text-white placeholder-slate-500"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-jubilee-600 to-jubilee-500 text-white font-semibold rounded-xl hover:from-jubilee-500 hover:to-jubilee-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-jubilee-500/20 hover:shadow-xl hover:shadow-jubilee-500/30 min-w-[140px]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-6 mt-8">
              {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-sm text-slate-400"
                >
                  <Icon className="h-4 w-4 text-jubilee-400" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* CTA links */}
            <div className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t border-white/5">
              <Link
                href="/domains/tlds"
                className="inline-flex items-center gap-2 text-sm font-medium text-jubilee-400 hover:text-jubilee-300 transition-colors"
              >
                <span>Browse all web spaces</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                <span>Learn how it works</span>
              </Link>
            </div>
          </div>

          {/* Right column - Globe */}
          <div className="order-1 lg:order-2 relative h-[350px] sm:h-[450px] lg:h-[650px]">
            {/* Globe glow backdrop */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-[90%] h-[90%] bg-gradient-radial from-jubilee-500/10 via-jubilee-600/5 to-transparent rounded-full blur-3xl" />
            </div>

            {/* Globe container */}
            <div className="relative w-full h-full">
              <Globe />
            </div>

            {/* Floating stats cards */}
            <div className="absolute top-4 right-4 lg:top-12 lg:right-8 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 px-5 py-4 shadow-xl animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-jubilee-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-jubilee-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">40+</div>
                  <div className="text-xs text-slate-400">Web Spaces</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-20 left-4 lg:bottom-32 lg:left-8 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 px-5 py-4 shadow-xl animate-float animation-delay-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">100%</div>
                  <div className="text-xs text-slate-400">Private Network</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 right-8 lg:bottom-12 lg:right-24 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 px-5 py-4 shadow-xl animate-float animation-delay-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-jubilee-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-white">Live on WWBW</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
    </section>
  );
}
