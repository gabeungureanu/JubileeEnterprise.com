import { useState } from 'react';
import { Search, Filter, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { compileApi } from '../../api/compile.api';
import { ROOT_DOMAINS } from '../../types/domain.types';

interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

const domainOptions = [
  { value: '', label: 'All Domains' },
  ...ROOT_DOMAINS.map((d) => ({ value: d, label: d }))
];

const guardrailOptions = [
  { value: '', label: 'All Levels' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [guardrail, setGuardrail] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (domain) filters.domain = domain;
      if (guardrail) filters.guardrailLevel = guardrail;

      const searchResults = await compileApi.search(query, filters, 20);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Search Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Qdrant vector database..."
              className={cn(
                'w-full pl-10 pr-4 py-2.5 rounded-lg',
                'border border-slate-300 bg-white',
                'text-sm text-slate-900 placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
              )}
            />
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSearch}
            loading={loading}
          >
            <Search className="w-4 h-4 mr-1" />
            Search
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
            <Select
              label="Domain"
              options={domainOptions}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <Select
              label="Guardrail Level"
              options={guardrailOptions}
              value={guardrail}
              onChange={(e) => setGuardrail(e.target.value)}
            />
            <Input
              label="Persona"
              placeholder="Filter by persona..."
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-sm">
              {query ? 'No results found' : 'Enter a search query to begin'}
            </p>
          </div>
        ) : (
          results.map((result) => (
            <div
              key={result.id}
              className="px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-slate-900">
                      {(result.payload.title as string) || 'Untitled'}
                    </h4>
                    <Badge
                      variant={result.score > 0.8 ? 'success' : result.score > 0.6 ? 'warning' : 'default'}
                      size="sm"
                    >
                      {(result.score * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {result.payload.domain as string}
                    {result.payload.persona && ` / ${result.payload.persona as string}`}
                    {' • '}
                    {result.payload.status as string}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {(result.payload.content as string)?.slice(0, 200)}...
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Results Count */}
      {results.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing {results.length} results for "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
