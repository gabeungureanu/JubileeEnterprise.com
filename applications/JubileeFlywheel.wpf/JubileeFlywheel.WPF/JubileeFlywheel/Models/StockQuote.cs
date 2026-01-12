using CommunityToolkit.Mvvm.ComponentModel;

namespace JubileeFlywheel.Models
{
    public partial class StockQuote : ObservableObject
    {
        [ObservableProperty]
        private string _symbol = string.Empty;

        [ObservableProperty]
        private string _name = string.Empty;

        [ObservableProperty]
        private decimal _price;

        [ObservableProperty]
        private decimal _change;

        [ObservableProperty]
        private double _changePercent;

        [ObservableProperty]
        private decimal _open;

        [ObservableProperty]
        private decimal _high;

        [ObservableProperty]
        private decimal _low;

        [ObservableProperty]
        private decimal _previousClose;

        [ObservableProperty]
        private long _volume;

        [ObservableProperty]
        private DateTime _lastUpdated;

        public bool IsPositive => ChangePercent >= 0;

        public string Exchange { get; set; } = "NASDAQ";

        public string Currency { get; set; } = "USD";
    }

    public class OhlcDataPoint
    {
        public DateTime Timestamp { get; set; }
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public decimal Close { get; set; }
        public long Volume { get; set; }

        public bool IsBullish => Close >= Open;
    }

    public enum TimeResolution
    {
        Tick,
        OneSecond,
        FiveSeconds,
        FifteenSeconds,
        ThirtySeconds,
        OneMinute,
        FiveMinutes,
        FifteenMinutes,
        ThirtyMinutes,
        OneHour,
        FourHours,
        OneDay,
        OneWeek,
        OneMonth
    }

    public enum TradingSession
    {
        PreMarket,
        Regular,
        AfterHours,
        Extended,
        AllDay
    }

    public class SymbolMetadata
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Exchange { get; set; } = string.Empty;
        public string Type { get; set; } = "Stock"; // Stock, ETF, Index, etc.
        public string Currency { get; set; } = "USD";
        public string Country { get; set; } = "US";
        public double MinMove { get; set; } = 0.01;
        public double PriceScale { get; set; } = 100;
        public bool HasIntraday { get; set; } = true;
        public bool HasDaily { get; set; } = true;
        public bool HasWeeklyAndMonthly { get; set; } = true;
        public List<string> SupportedResolutions { get; set; } = new();
        public string Timezone { get; set; } = "America/New_York";
        public string SessionRegular { get; set; } = "0930-1600";
        public string SessionExtended { get; set; } = "0400-2000";
    }

    public class SessionCalendar
    {
        public TradingSession CurrentSession { get; set; } = TradingSession.Regular;
        public DateTime SessionStart { get; set; }
        public DateTime SessionEnd { get; set; }
        public bool IsMarketOpen { get; set; }
        public DateTime? NextOpen { get; set; }
        public DateTime? NextClose { get; set; }

        public static SessionCalendar GetCurrentSession()
        {
            var now = DateTime.Now;
            var timeOfDay = now.TimeOfDay;

            var calendar = new SessionCalendar
            {
                SessionStart = now.Date.AddHours(9).AddMinutes(30),
                SessionEnd = now.Date.AddHours(16)
            };

            // Check if weekend
            if (now.DayOfWeek == DayOfWeek.Saturday || now.DayOfWeek == DayOfWeek.Sunday)
            {
                calendar.IsMarketOpen = false;
                calendar.CurrentSession = TradingSession.Regular;
                return calendar;
            }

            // Pre-market: 4:00 AM - 9:30 AM ET
            if (timeOfDay >= TimeSpan.FromHours(4) && timeOfDay < TimeSpan.FromHours(9.5))
            {
                calendar.CurrentSession = TradingSession.PreMarket;
                calendar.IsMarketOpen = true;
            }
            // Regular: 9:30 AM - 4:00 PM ET
            else if (timeOfDay >= TimeSpan.FromHours(9.5) && timeOfDay < TimeSpan.FromHours(16))
            {
                calendar.CurrentSession = TradingSession.Regular;
                calendar.IsMarketOpen = true;
            }
            // After-hours: 4:00 PM - 8:00 PM ET
            else if (timeOfDay >= TimeSpan.FromHours(16) && timeOfDay < TimeSpan.FromHours(20))
            {
                calendar.CurrentSession = TradingSession.AfterHours;
                calendar.IsMarketOpen = true;
            }
            else
            {
                calendar.IsMarketOpen = false;
            }

            return calendar;
        }
    }
}
