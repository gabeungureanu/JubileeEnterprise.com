'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Check,
  X,
  Loader2,
  ArrowLeft,
  ShoppingCart,
  Sparkles,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { HeaderNav } from '@/components/HeaderNav';
import { Footer } from '@/components/Footer';
import { api, type DomainSearchResult, type DomainSuggestion } from '@/lib/api';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get('query') || '';
  const mode = searchParams.get('mode') || 'register';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    } else {
      setIsLoading(false);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.checkAvailability(searchQuery.trim().toLowerCase());
      setResults(response.results);
      setSuggestions(response.suggestions);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to search domains. Please try again.');
      setResults([]);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const params = new URLSearchParams({ query: query.trim().toLowerCase(), mode });
      router.push(`/domains/search?${params.toString()}`);
      performSearch(query.trim());
    }
  };

  const toggleDomain = (fullDomain: string) => {
    const newSelected = new Set(selectedDomains);
    if (newSelected.has(fullDomain)) {
      newSelected.delete(fullDomain);
    } else {
      newSelected.add(fullDomain);
    }
    setSelectedDomains(newSelected);
  };

  const handleProceed = () => {
    if (selectedDomains.size > 0) {
      const domains = Array.from(selectedDomains).join(',');
      router.push(`/domains/register?domains=${encodeURIComponent(domains)}`);
    }
  };

  const getStatusIcon = (result: DomainSearchResult) => {
    if (result.available) {
      return <Check className="h-5 w-5 text-green-500" />;
    }
    return <X className="h-5 w-5 text-red-400" />;
  };

  const getStatusBadge = (result: DomainSearchResult) => {
    if (result.available) {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Available</span>;
    }
    if (result.status === 'restricted') {
      return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Restricted</span>;
    }
    if (result.status === 'reserved') {
      return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Reserved</span>;
    }
    return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">Taken</span>;
  };

  const availableCount = results.filter(r => r.available).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-jubilee-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        {/* Search form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <form onSubmit={handleNewSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder="Search for a domain..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jubilee-500 focus:border-jubilee-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-jubilee-600 text-white font-medium rounded-lg hover:bg-jubilee-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-jubilee-600 mx-auto mb-4" />
            <p className="text-gray-600">Searching for available domains...</p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => performSearch(query)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && results.length > 0 && (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Results for "{initialQuery}"
                </h1>
                <p className="text-gray-600 mt-1">
                  {availableCount} of {results.length} domains available
                </p>
              </div>
              {selectedDomains.size > 0 && (
                <button
                  onClick={handleProceed}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-lg"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>Register {selectedDomains.size} Domain{selectedDomains.size > 1 ? 's' : ''}</span>
                </button>
              )}
            </div>

            {/* Results list */}
            <div className="space-y-3 mb-8">
              {results.map((result) => (
                <div
                  key={result.fullDomain}
                  className={`
                    flex items-center justify-between p-4 rounded-xl border-2 transition-all
                    ${result.available
                      ? selectedDomains.has(result.fullDomain)
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-green-200 bg-white hover:border-green-300 hover:shadow-sm'
                      : 'border-gray-200 bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(result)}
                    <div>
                      <span className="text-lg font-semibold text-gray-900">
                        {result.fullDomain}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(result)}
                        {result.requiresVerification && (
                          <span className="text-xs text-gray-500">Requires verification</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPrice(result.pricePerYear)}
                      </span>
                      <span className="text-gray-500 text-sm">/year</span>
                    </div>
                    {result.available && (
                      <button
                        onClick={() => toggleDomain(result.fullDomain)}
                        className={`
                          px-4 py-2 rounded-lg font-medium transition-colors
                          ${selectedDomains.has(result.fullDomain)
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-jubilee-600 text-white hover:bg-jubilee-700'
                          }
                        `}
                      >
                        {selectedDomains.has(result.fullDomain) ? 'Selected' : 'Select'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="h-5 w-5 text-gold-500" />
                  <h2 className="text-lg font-semibold text-gray-900">You might also like</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.fullDomain}
                      onClick={() => {
                        setQuery(suggestion.name);
                        const params = new URLSearchParams({ query: suggestion.name, mode });
                        router.push(`/domains/search?${params.toString()}`);
                        performSearch(suggestion.name);
                      }}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-jubilee-300 hover:shadow-sm transition-all text-left"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{suggestion.fullDomain}</span>
                        <span className="block text-xs text-gray-400 mt-1">
                          {suggestion.reason === 'alternative_tld' && 'Different extension'}
                          {suggestion.reason === 'variation' && 'Name variation'}
                          {suggestion.reason === 'synonym' && 'Similar meaning'}
                        </span>
                      </div>
                      <span className="text-gray-600 font-medium">
                        {formatPrice(suggestion.pricePerYear)}/yr
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* No query state */}
        {!isLoading && !error && !initialQuery && (
          <div className="text-center py-16">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Search for a domain</h2>
            <p className="text-gray-600">
              Enter a name above to check availability across all Inspire Web Spaces.
            </p>
          </div>
        )}

        {/* No results state */}
        {!isLoading && !error && initialQuery && results.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No results found</h2>
            <p className="text-gray-600">
              Try a different domain name or check your spelling.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-jubilee-600" />
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
