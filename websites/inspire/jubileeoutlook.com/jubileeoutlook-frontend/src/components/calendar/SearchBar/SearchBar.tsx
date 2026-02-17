import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import './SearchBar.css';

export interface SearchFilters {
  query: string;
  category: string;
}

export interface SearchBarHandle {
  focus: () => void;
}

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
}

const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(({ onSearch, onClear }, ref) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const emitSearch = useCallback((q: string, cat: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q || cat) {
        onSearch({ query: q, category: cat });
      } else {
        onClear();
      }
    }, 300);
  }, [onSearch, onClear]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    emitSearch(value, category);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    emitSearch(query, value);
  };

  const handleClear = () => {
    setQuery('');
    setCategory('');
    setShowFilters(false);
    onClear();
  };

  return (
    <div className="search-bar">
      <div className="search-bar__input-row">
        <span className="material-symbols-outlined search-bar__icon">search</span>
        <input
          ref={inputRef}
          type="text"
          className="search-bar__input"
          placeholder="Search events..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        {(query || category) && (
          <button className="search-bar__clear" onClick={handleClear} title="Clear search">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
        <button
          className={`search-bar__filter-btn ${showFilters ? 'search-bar__filter-btn--active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Filter by category"
        >
          <span className="material-symbols-outlined">filter_list</span>
        </button>
      </div>
      {showFilters && (
        <div className="search-bar__filters">
          <label className="search-bar__filter-label">Category:</label>
          <select
            className="search-bar__filter-select"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">All categories</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="orange">Orange</option>
            <option value="purple">Purple</option>
            <option value="red">Red</option>
            <option value="yellow">Yellow</option>
          </select>
        </div>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
