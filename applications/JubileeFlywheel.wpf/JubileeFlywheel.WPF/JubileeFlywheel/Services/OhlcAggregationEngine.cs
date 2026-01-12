using System.Collections.Concurrent;
using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public interface IOhlcAggregationEngine
    {
        event EventHandler<OhlcDataPoint>? CandleCompleted;
        event EventHandler<OhlcDataPoint>? CandleUpdated;

        void ProcessTick(string symbol, decimal price, long volume, DateTime timestamp);
        OhlcDataPoint? GetCurrentCandle(string symbol);
        IEnumerable<OhlcDataPoint> GetCandles(string symbol, int count);
        IEnumerable<OhlcDataPoint> AggregateToResolution(IEnumerable<OhlcDataPoint> sourceData, TimeResolution sourceResolution, TimeResolution targetResolution);
        void SetResolution(string symbol, TimeResolution resolution);
        void Reset(string symbol);
        void Clear();
    }

    public class OhlcAggregationEngine : IOhlcAggregationEngine
    {
        private readonly ConcurrentDictionary<string, SymbolAggregator> _aggregators;
        private readonly object _syncLock = new();

        public event EventHandler<OhlcDataPoint>? CandleCompleted;
        public event EventHandler<OhlcDataPoint>? CandleUpdated;

        public OhlcAggregationEngine()
        {
            _aggregators = new ConcurrentDictionary<string, SymbolAggregator>();
        }

        public void ProcessTick(string symbol, decimal price, long volume, DateTime timestamp)
        {
            var aggregator = _aggregators.GetOrAdd(symbol, s => new SymbolAggregator(s, TimeResolution.OneMinute));

            var (candleComplete, candle) = aggregator.ProcessTick(price, volume, timestamp);

            if (candle != null)
            {
                if (candleComplete)
                {
                    CandleCompleted?.Invoke(this, candle);
                }
                else
                {
                    CandleUpdated?.Invoke(this, candle);
                }
            }
        }

        public OhlcDataPoint? GetCurrentCandle(string symbol)
        {
            return _aggregators.TryGetValue(symbol.ToUpperInvariant(), out var aggregator)
                ? aggregator.CurrentCandle
                : null;
        }

        public IEnumerable<OhlcDataPoint> GetCandles(string symbol, int count)
        {
            if (_aggregators.TryGetValue(symbol.ToUpperInvariant(), out var aggregator))
            {
                return aggregator.GetCandles(count);
            }
            return Enumerable.Empty<OhlcDataPoint>();
        }

        public IEnumerable<OhlcDataPoint> AggregateToResolution(
            IEnumerable<OhlcDataPoint> sourceData,
            TimeResolution sourceResolution,
            TimeResolution targetResolution)
        {
            if (targetResolution <= sourceResolution)
            {
                return sourceData;
            }

            var targetInterval = GetTimeInterval(targetResolution);
            var result = new List<OhlcDataPoint>();
            OhlcDataPoint? currentCandle = null;
            DateTime? currentBucketStart = null;

            foreach (var point in sourceData.OrderBy(p => p.Timestamp))
            {
                var bucketStart = GetBucketStart(point.Timestamp, targetInterval);

                if (currentBucketStart == null || bucketStart != currentBucketStart)
                {
                    // Start new candle
                    if (currentCandle != null)
                    {
                        result.Add(currentCandle);
                    }

                    currentCandle = new OhlcDataPoint
                    {
                        Timestamp = bucketStart,
                        Open = point.Open,
                        High = point.High,
                        Low = point.Low,
                        Close = point.Close,
                        Volume = point.Volume
                    };
                    currentBucketStart = bucketStart;
                }
                else if (currentCandle != null)
                {
                    // Update existing candle
                    currentCandle.High = Math.Max(currentCandle.High, point.High);
                    currentCandle.Low = Math.Min(currentCandle.Low, point.Low);
                    currentCandle.Close = point.Close;
                    currentCandle.Volume += point.Volume;
                }
            }

            // Add the last candle
            if (currentCandle != null)
            {
                result.Add(currentCandle);
            }

            return result;
        }

        public void SetResolution(string symbol, TimeResolution resolution)
        {
            var upperSymbol = symbol.ToUpperInvariant();
            if (_aggregators.TryGetValue(upperSymbol, out var aggregator))
            {
                aggregator.SetResolution(resolution);
            }
            else
            {
                _aggregators[upperSymbol] = new SymbolAggregator(upperSymbol, resolution);
            }
        }

        public void Reset(string symbol)
        {
            var upperSymbol = symbol.ToUpperInvariant();
            if (_aggregators.TryGetValue(upperSymbol, out var aggregator))
            {
                aggregator.Reset();
            }
        }

        public void Clear()
        {
            _aggregators.Clear();
        }

        private static DateTime GetBucketStart(DateTime timestamp, TimeSpan interval)
        {
            var ticks = timestamp.Ticks / interval.Ticks;
            return new DateTime(ticks * interval.Ticks);
        }

        private static TimeSpan GetTimeInterval(TimeResolution resolution) => resolution switch
        {
            TimeResolution.Tick => TimeSpan.FromMilliseconds(100),
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

        private class SymbolAggregator
        {
            private readonly string _symbol;
            private readonly List<OhlcDataPoint> _candles;
            private readonly object _lock = new();
            private TimeResolution _resolution;
            private TimeSpan _interval;
            private OhlcDataPoint? _currentCandle;
            private DateTime? _currentBucketStart;

            public OhlcDataPoint? CurrentCandle => _currentCandle;

            public SymbolAggregator(string symbol, TimeResolution resolution)
            {
                _symbol = symbol;
                _candles = new List<OhlcDataPoint>();
                SetResolution(resolution);
            }

            public void SetResolution(TimeResolution resolution)
            {
                lock (_lock)
                {
                    _resolution = resolution;
                    _interval = GetTimeInterval(resolution);

                    // When resolution changes, clear current candle
                    // Historical candles are preserved but will need re-aggregation
                    _currentCandle = null;
                    _currentBucketStart = null;
                }
            }

            public (bool CandleComplete, OhlcDataPoint? Candle) ProcessTick(decimal price, long volume, DateTime timestamp)
            {
                lock (_lock)
                {
                    var bucketStart = GetBucketStart(timestamp, _interval);

                    if (_currentBucketStart == null || bucketStart != _currentBucketStart)
                    {
                        // Complete previous candle and start new one
                        OhlcDataPoint? completedCandle = null;
                        if (_currentCandle != null)
                        {
                            _candles.Add(_currentCandle);
                            completedCandle = _currentCandle;

                            // Keep only last 1000 candles
                            if (_candles.Count > 1000)
                            {
                                _candles.RemoveAt(0);
                            }
                        }

                        _currentCandle = new OhlcDataPoint
                        {
                            Timestamp = bucketStart,
                            Open = price,
                            High = price,
                            Low = price,
                            Close = price,
                            Volume = volume
                        };
                        _currentBucketStart = bucketStart;

                        return completedCandle != null
                            ? (true, completedCandle)
                            : (false, _currentCandle);
                    }
                    else
                    {
                        // Update current candle
                        _currentCandle!.High = Math.Max(_currentCandle.High, price);
                        _currentCandle.Low = Math.Min(_currentCandle.Low, price);
                        _currentCandle.Close = price;
                        _currentCandle.Volume += volume;

                        return (false, _currentCandle);
                    }
                }
            }

            public IEnumerable<OhlcDataPoint> GetCandles(int count)
            {
                lock (_lock)
                {
                    var result = _candles.TakeLast(count).ToList();
                    if (_currentCandle != null)
                    {
                        result.Add(_currentCandle);
                    }
                    return result;
                }
            }

            public void Reset()
            {
                lock (_lock)
                {
                    _candles.Clear();
                    _currentCandle = null;
                    _currentBucketStart = null;
                }
            }
        }
    }

    public static class TimeResolutionExtensions
    {
        public static string ToDisplayString(this TimeResolution resolution) => resolution switch
        {
            TimeResolution.Tick => "Tick",
            TimeResolution.OneSecond => "1s",
            TimeResolution.FiveSeconds => "5s",
            TimeResolution.FifteenSeconds => "15s",
            TimeResolution.ThirtySeconds => "30s",
            TimeResolution.OneMinute => "1m",
            TimeResolution.FiveMinutes => "5m",
            TimeResolution.FifteenMinutes => "15m",
            TimeResolution.ThirtyMinutes => "30m",
            TimeResolution.OneHour => "1H",
            TimeResolution.FourHours => "4H",
            TimeResolution.OneDay => "D",
            TimeResolution.OneWeek => "W",
            TimeResolution.OneMonth => "M",
            _ => "?"
        };

        public static TimeResolution FromString(string value) => value.ToUpperInvariant() switch
        {
            "TICK" => TimeResolution.Tick,
            "1S" => TimeResolution.OneSecond,
            "5S" => TimeResolution.FiveSeconds,
            "15S" => TimeResolution.FifteenSeconds,
            "30S" => TimeResolution.ThirtySeconds,
            "1" or "1M" => TimeResolution.OneMinute,
            "5" or "5M" => TimeResolution.FiveMinutes,
            "15" or "15M" => TimeResolution.FifteenMinutes,
            "30" or "30M" => TimeResolution.ThirtyMinutes,
            "60" or "1H" => TimeResolution.OneHour,
            "240" or "4H" => TimeResolution.FourHours,
            "D" or "1D" => TimeResolution.OneDay,
            "W" or "1W" => TimeResolution.OneWeek,
            "M" or "1MO" => TimeResolution.OneMonth,
            _ => TimeResolution.OneMinute
        };
    }
}
