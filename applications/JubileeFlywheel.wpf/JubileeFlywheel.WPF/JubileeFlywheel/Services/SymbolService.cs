using System.Collections.Concurrent;
using System.Runtime.Caching;
using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public class SymbolService : ISymbolService
    {
        private readonly MemoryCache _symbolCache;
        private readonly MemoryCache _quoteCache;
        private readonly MemoryCache _dataCache;
        private readonly ConcurrentDictionary<string, SymbolMetadata> _symbolRegistry;
        private readonly SemaphoreSlim _searchSemaphore = new(1, 1);

        private static readonly TimeSpan SymbolCacheExpiration = TimeSpan.FromHours(24);
        private static readonly TimeSpan QuoteCacheExpiration = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan DataCacheExpiration = TimeSpan.FromMinutes(5);

        public SymbolService()
        {
            _symbolCache = new MemoryCache("SymbolCache");
            _quoteCache = new MemoryCache("QuoteCache");
            _dataCache = new MemoryCache("DataCache");
            _symbolRegistry = new ConcurrentDictionary<string, SymbolMetadata>();

            InitializeSymbolRegistry();
        }

        private void InitializeSymbolRegistry()
        {
            // Pre-populate with common US equity symbols
            var symbols = new List<SymbolMetadata>
            {
                new() { Symbol = "AAPL", Name = "Apple Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "MSFT", Name = "Microsoft Corporation", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "GOOGL", Name = "Alphabet Inc. Class A", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "GOOG", Name = "Alphabet Inc. Class C", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "AMZN", Name = "Amazon.com Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "META", Name = "Meta Platforms Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "NVDA", Name = "NVIDIA Corporation", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "TSLA", Name = "Tesla Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "AMD", Name = "Advanced Micro Devices Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "INTC", Name = "Intel Corporation", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "NFLX", Name = "Netflix Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "ADBE", Name = "Adobe Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "CRM", Name = "Salesforce Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "ORCL", Name = "Oracle Corporation", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "CSCO", Name = "Cisco Systems Inc.", Exchange = "NASDAQ", Type = "Stock" },

                // Financials
                new() { Symbol = "JPM", Name = "JPMorgan Chase & Co.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "BAC", Name = "Bank of America Corp.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "WFC", Name = "Wells Fargo & Co.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "GS", Name = "Goldman Sachs Group Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "MS", Name = "Morgan Stanley", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "V", Name = "Visa Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "MA", Name = "Mastercard Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "PYPL", Name = "PayPal Holdings Inc.", Exchange = "NASDAQ", Type = "Stock" },

                // Healthcare
                new() { Symbol = "JNJ", Name = "Johnson & Johnson", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "UNH", Name = "UnitedHealth Group Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "PFE", Name = "Pfizer Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "MRK", Name = "Merck & Co. Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "ABBV", Name = "AbbVie Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "LLY", Name = "Eli Lilly and Company", Exchange = "NYSE", Type = "Stock" },

                // Consumer
                new() { Symbol = "KO", Name = "The Coca-Cola Company", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "PEP", Name = "PepsiCo Inc.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "WMT", Name = "Walmart Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "COST", Name = "Costco Wholesale Corp.", Exchange = "NASDAQ", Type = "Stock" },
                new() { Symbol = "HD", Name = "The Home Depot Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "NKE", Name = "Nike Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "MCD", Name = "McDonald's Corporation", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "SBUX", Name = "Starbucks Corporation", Exchange = "NASDAQ", Type = "Stock" },

                // Industrial
                new() { Symbol = "BA", Name = "The Boeing Company", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "CAT", Name = "Caterpillar Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "GE", Name = "General Electric Company", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "MMM", Name = "3M Company", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "UPS", Name = "United Parcel Service Inc.", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "FDX", Name = "FedEx Corporation", Exchange = "NYSE", Type = "Stock" },

                // Energy
                new() { Symbol = "XOM", Name = "Exxon Mobil Corporation", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "CVX", Name = "Chevron Corporation", Exchange = "NYSE", Type = "Stock" },
                new() { Symbol = "COP", Name = "ConocoPhillips", Exchange = "NYSE", Type = "Stock" },

                // ETFs
                new() { Symbol = "SPY", Name = "SPDR S&P 500 ETF Trust", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "QQQ", Name = "Invesco QQQ Trust", Exchange = "NASDAQ", Type = "ETF" },
                new() { Symbol = "IWM", Name = "iShares Russell 2000 ETF", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "DIA", Name = "SPDR Dow Jones Industrial Average ETF", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "VOO", Name = "Vanguard S&P 500 ETF", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "VTI", Name = "Vanguard Total Stock Market ETF", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "ARKK", Name = "ARK Innovation ETF", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "XLF", Name = "Financial Select Sector SPDR Fund", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "XLE", Name = "Energy Select Sector SPDR Fund", Exchange = "NYSE", Type = "ETF" },
                new() { Symbol = "XLK", Name = "Technology Select Sector SPDR Fund", Exchange = "NYSE", Type = "ETF" },

                // Indices (display only)
                new() { Symbol = "^SPX", Name = "S&P 500 Index", Exchange = "INDEX", Type = "Index" },
                new() { Symbol = "^IXIC", Name = "NASDAQ Composite", Exchange = "INDEX", Type = "Index" },
                new() { Symbol = "^DJI", Name = "Dow Jones Industrial Average", Exchange = "INDEX", Type = "Index" },
                new() { Symbol = "^VIX", Name = "CBOE Volatility Index", Exchange = "INDEX", Type = "Index" },
            };

            foreach (var symbol in symbols)
            {
                symbol.SupportedResolutions = GetSupportedResolutions().ToList();
                _symbolRegistry.TryAdd(symbol.Symbol, symbol);
            }
        }

        public async Task<IEnumerable<SymbolMetadata>> SearchSymbolsAsync(string query, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(query))
                return Enumerable.Empty<SymbolMetadata>();

            var cacheKey = $"search_{query.ToUpperInvariant()}";
            if (_symbolCache.Get(cacheKey) is IEnumerable<SymbolMetadata> cached)
                return cached;

            await _searchSemaphore.WaitAsync(cancellationToken);
            try
            {
                // Double-check cache after acquiring lock
                if (_symbolCache.Get(cacheKey) is IEnumerable<SymbolMetadata> cachedAgain)
                    return cachedAgain;

                var upperQuery = query.ToUpperInvariant();
                var results = _symbolRegistry.Values
                    .Where(s => s.Symbol.Contains(upperQuery, StringComparison.OrdinalIgnoreCase) ||
                               s.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(s => s.Symbol.StartsWith(upperQuery, StringComparison.OrdinalIgnoreCase))
                    .ThenBy(s => s.Symbol.Length)
                    .ThenBy(s => s.Symbol)
                    .Take(20)
                    .ToList();

                var policy = new CacheItemPolicy
                {
                    AbsoluteExpiration = DateTimeOffset.Now.Add(SymbolCacheExpiration)
                };
                _symbolCache.Set(cacheKey, results, policy);

                return results;
            }
            finally
            {
                _searchSemaphore.Release();
            }
        }

        public Task<SymbolMetadata?> GetSymbolMetadataAsync(string symbol, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(symbol))
                return Task.FromResult<SymbolMetadata?>(null);

            var upperSymbol = symbol.ToUpperInvariant();
            _symbolRegistry.TryGetValue(upperSymbol, out var metadata);
            return Task.FromResult(metadata);
        }

        public async Task<StockQuote?> GetQuoteAsync(string symbol, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(symbol))
                return null;

            var cacheKey = $"quote_{symbol.ToUpperInvariant()}";
            if (_quoteCache.Get(cacheKey) is StockQuote cached)
                return cached;

            // Generate simulated quote data
            var metadata = await GetSymbolMetadataAsync(symbol, cancellationToken);
            if (metadata == null)
                return null;

            var random = new Random(symbol.GetHashCode() + DateTime.Now.Second);
            var basePrice = GetBasePrice(symbol);
            var changePercent = (random.NextDouble() - 0.5) * 4;
            var change = basePrice * (decimal)(changePercent / 100);

            var quote = new StockQuote
            {
                Symbol = metadata.Symbol,
                Name = metadata.Name,
                Exchange = metadata.Exchange,
                Price = basePrice + change,
                Change = change,
                ChangePercent = changePercent,
                Open = basePrice * (1 + (decimal)(random.NextDouble() - 0.5) * 0.02m),
                High = basePrice * (1 + (decimal)random.NextDouble() * 0.03m),
                Low = basePrice * (1 - (decimal)random.NextDouble() * 0.03m),
                PreviousClose = basePrice,
                Volume = random.Next(1000000, 50000000),
                LastUpdated = DateTime.Now
            };

            var policy = new CacheItemPolicy
            {
                AbsoluteExpiration = DateTimeOffset.Now.Add(QuoteCacheExpiration)
            };
            _quoteCache.Set(cacheKey, quote, policy);

            return quote;
        }

        public async Task<IEnumerable<OhlcDataPoint>> GetHistoricalDataAsync(string symbol, TimeResolution resolution, DateTime start, DateTime end, CancellationToken cancellationToken = default)
        {
            var cacheKey = $"hist_{symbol}_{resolution}_{start:yyyyMMdd}_{end:yyyyMMdd}";
            if (_dataCache.Get(cacheKey) is IEnumerable<OhlcDataPoint> cached)
                return cached;

            var data = await GenerateHistoricalData(symbol, resolution, start, end, cancellationToken);

            var policy = new CacheItemPolicy
            {
                AbsoluteExpiration = DateTimeOffset.Now.Add(DataCacheExpiration)
            };
            _dataCache.Set(cacheKey, data, policy);

            return data;
        }

        public Task<IEnumerable<OhlcDataPoint>> GetRealtimeDataAsync(string symbol, TimeResolution resolution, CancellationToken cancellationToken = default)
        {
            var end = DateTime.Now;
            var start = resolution switch
            {
                TimeResolution.Tick => end.AddMinutes(-5),
                TimeResolution.OneSecond => end.AddMinutes(-10),
                TimeResolution.FiveSeconds => end.AddMinutes(-30),
                TimeResolution.FifteenSeconds => end.AddHours(-1),
                TimeResolution.ThirtySeconds => end.AddHours(-2),
                TimeResolution.OneMinute => end.AddHours(-6),
                TimeResolution.FiveMinutes => end.AddDays(-1),
                TimeResolution.FifteenMinutes => end.AddDays(-3),
                TimeResolution.ThirtyMinutes => end.AddDays(-5),
                TimeResolution.OneHour => end.AddDays(-10),
                TimeResolution.FourHours => end.AddDays(-30),
                TimeResolution.OneDay => end.AddDays(-365),
                TimeResolution.OneWeek => end.AddDays(-730),
                TimeResolution.OneMonth => end.AddDays(-1825),
                _ => end.AddDays(-30)
            };

            return GetHistoricalDataAsync(symbol, resolution, start, end, cancellationToken);
        }

        private async Task<List<OhlcDataPoint>> GenerateHistoricalData(string symbol, TimeResolution resolution, DateTime start, DateTime end, CancellationToken cancellationToken)
        {
            await Task.Yield(); // Make it async

            var data = new List<OhlcDataPoint>();
            var basePrice = GetBasePrice(symbol);
            var random = new Random(symbol.GetHashCode());
            var interval = GetTimeInterval(resolution);
            var current = start;
            var price = basePrice;

            while (current <= end && !cancellationToken.IsCancellationRequested)
            {
                // Skip weekends for daily+ data
                if (resolution >= TimeResolution.OneDay &&
                    (current.DayOfWeek == DayOfWeek.Saturday || current.DayOfWeek == DayOfWeek.Sunday))
                {
                    current = current.Add(interval);
                    continue;
                }

                // Skip outside market hours for intraday data
                if (resolution < TimeResolution.OneDay)
                {
                    var timeOfDay = current.TimeOfDay;
                    if (timeOfDay < TimeSpan.FromHours(9.5) || timeOfDay > TimeSpan.FromHours(16))
                    {
                        current = current.Add(interval);
                        continue;
                    }
                }

                // Generate realistic OHLC data with some randomness
                var volatility = GetVolatility(symbol) * (decimal)Math.Sqrt(interval.TotalMinutes / 60.0);
                var trend = (decimal)(random.NextDouble() - 0.48) * volatility; // Slight upward bias

                var open = price;
                var change1 = (decimal)(random.NextDouble() - 0.5) * volatility;
                var change2 = (decimal)(random.NextDouble() - 0.5) * volatility;
                var close = price * (1 + trend);

                var high = Math.Max(open, close) * (1 + Math.Abs(change1));
                var low = Math.Min(open, close) * (1 - Math.Abs(change2));

                data.Add(new OhlcDataPoint
                {
                    Timestamp = current,
                    Open = Math.Round(open, 2),
                    High = Math.Round(high, 2),
                    Low = Math.Round(low, 2),
                    Close = Math.Round(close, 2),
                    Volume = random.Next(10000, 1000000)
                });

                price = close;
                current = current.Add(interval);
            }

            return data;
        }

        private static TimeSpan GetTimeInterval(TimeResolution resolution) => resolution switch
        {
            TimeResolution.Tick => TimeSpan.FromMilliseconds(500),
            TimeResolution.OneSecond => TimeSpan.FromSeconds(1),
            TimeResolution.FiveSeconds => TimeSpan.FromSeconds(5),
            TimeResolution.FifteenSeconds => TimeSpan.FromSeconds(15),
            TimeResolution.ThirtySeconds => TimeSpan.FromSeconds(30),
            TimeResolution.OneMinute => TimeSpan.FromMinutes(1),
            TimeResolution.FiveMinutes => TimeSpan.FromMinutes(5),
            TimeResolution.FifteenMinutes => TimeSpan.FromMinutes(15),
            TimeResolution.ThirtyMinutes => TimeSpan.FromMinutes(30),
            TimeResolution.OneHour => TimeSpan.FromHours(1),
            TimeResolution.FourHours => TimeSpan.FromHours(4),
            TimeResolution.OneDay => TimeSpan.FromDays(1),
            TimeResolution.OneWeek => TimeSpan.FromDays(7),
            TimeResolution.OneMonth => TimeSpan.FromDays(30),
            _ => TimeSpan.FromMinutes(1)
        };

        private static decimal GetBasePrice(string symbol) => symbol.ToUpperInvariant() switch
        {
            "AAPL" => 189.50m,
            "MSFT" => 378.00m,
            "GOOGL" => 141.50m,
            "GOOG" => 142.80m,
            "AMZN" => 178.00m,
            "META" => 505.00m,
            "NVDA" => 495.00m,
            "TSLA" => 248.00m,
            "AMD" => 145.00m,
            "INTC" => 42.50m,
            "NFLX" => 485.00m,
            "JPM" => 195.00m,
            "V" => 276.00m,
            "MA" => 450.00m,
            "SPY" => 502.00m,
            "QQQ" => 420.00m,
            _ => 100.00m + (decimal)(symbol.GetHashCode() % 400)
        };

        private static decimal GetVolatility(string symbol) => symbol.ToUpperInvariant() switch
        {
            "TSLA" => 0.04m,
            "NVDA" => 0.035m,
            "AMD" => 0.03m,
            "META" => 0.025m,
            "ARKK" => 0.035m,
            "^VIX" => 0.05m,
            _ => 0.015m
        };

        public IEnumerable<string> GetSupportedResolutions()
        {
            return new[]
            {
                "1s", "5s", "15s", "30s",
                "1", "5", "15", "30", "60", "240",
                "D", "W", "M"
            };
        }

        public IEnumerable<string> GetPopularSymbols()
        {
            return new[]
            {
                "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
                "SPY", "QQQ", "JPM", "V", "JNJ", "XOM"
            };
        }
    }
}
