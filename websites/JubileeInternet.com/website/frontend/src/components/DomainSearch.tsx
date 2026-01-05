'use client';

import { useState } from 'react';
import { Search, Check, X, Loader2, Sparkles } from 'lucide-react';
import { api, type DomainSearchResult, type DomainSuggestion } from '@/lib/api';

interface DomainSearchProps {
  onSelect?: (domain: DomainSearchResult) => void;
  showRegisterButton?: boolean;
}

export function DomainSearch({ onSelect, showRegisterButton = true }: DomainSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await api.checkAvailability(query.trim());
      setResults(response.results);
      setSuggestions(response.suggestions);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusIcon = (result: DomainSearchResult) => {
    if (result.available) {
      return <Check className="h-5 w-5 text-green-500" />;
    }
    return <X className="h-5 w-5 text-red-400" />;
  };

  const getStatusBadge = (result: DomainSearchResult) => {
    if (result.available) {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Available</span>;
    }
    if (result.status === 'restricted') {
      return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Restricted</span>;
    }
    if (result.status === 'reserved') {
      return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Reserved</span>;
    }
    return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Taken</span>;
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your desired domain name..."
              className="w-full pl-12 pr-4 py-4 text-lg border-2 border-r-0 border-gray-200 rounded-l-xl focus:border-jubilee-500 focus:ring-0 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-8 py-4 bg-jubilee-600 text-white font-semibold rounded-r-xl hover:bg-jubilee-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="mt-8">
          {results.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={result.fullDomain}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                      result.available
                        ? 'border-green-200 bg-green-50 hover:border-green-300'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(result)}
                      <span className="font-medium text-gray-900">{result.fullDomain}</span>
                      {getStatusBadge(result)}
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">
                        {formatPrice(result.pricePerYear)}/year
                      </span>
                      {result.available && showRegisterButton && (
                        <button
                          onClick={() => onSelect?.(result)}
                          className="btn-primary text-sm"
                        >
                          Register
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500">No results found.</p>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="h-5 w-5 text-gold-500" />
                <h3 className="text-lg font-semibold text-gray-900">Suggestions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.fullDomain}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:border-jubilee-300 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{suggestion.fullDomain}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {suggestion.reason === 'alternative_tld' && 'Different extension'}
                        {suggestion.reason === 'variation' && 'Name variation'}
                      </span>
                    </div>
                    <span className="text-gray-600 text-sm">
                      {formatPrice(suggestion.pricePerYear)}/yr
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
