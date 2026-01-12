using CommunityToolkit.Mvvm.ComponentModel;

namespace JubileeFlywheel.Models
{
    public partial class RadarScreenItem : ObservableObject
    {
        [ObservableProperty]
        private string _symbol = string.Empty;

        [ObservableProperty]
        private string _description = string.Empty;

        [ObservableProperty]
        private decimal _last;

        [ObservableProperty]
        private decimal _netChg;

        [ObservableProperty]
        private double _netPctChg;

        [ObservableProperty]
        private long _volume;

        [ObservableProperty]
        private string _interval = "Daily";

        // MACD Indicators
        [ObservableProperty]
        private double _macd;

        [ObservableProperty]
        private double _macdDiff;

        // Momentum
        [ObservableProperty]
        private double _momentum;

        // Price Channel
        [ObservableProperty]
        private decimal _upperBand;

        [ObservableProperty]
        private decimal _lowerBand;

        // Candlestick Pattern
        [ObservableProperty]
        private string _candlestickPattern = string.Empty;

        [ObservableProperty]
        private CandlestickPatternType _patternType = CandlestickPatternType.None;

        // Signals
        [ObservableProperty]
        private SignalType _signal = SignalType.None;

        [ObservableProperty]
        private string _signalText = string.Empty;

        // MACD RS (Relative Strength)
        [ObservableProperty]
        private string _macdRsAlert = string.Empty;

        [ObservableProperty]
        private double _macdRsDiff;

        [ObservableProperty]
        private int _xBarsAgo;

        // RSI
        [ObservableProperty]
        private double _rsi;

        [ObservableProperty]
        private string _rsiAlert = string.Empty;

        [ObservableProperty]
        private RsiCondition _rsiCondition = RsiCondition.Normal;

        // Computed properties
        public bool IsPositive => NetPctChg >= 0;
        public bool IsBullishPattern => PatternType == CandlestickPatternType.Bullish;
        public bool IsBearishPattern => PatternType == CandlestickPatternType.Bearish;
        public bool IsBullishSignal => Signal == SignalType.Bullish || Signal == SignalType.BullishT;
        public bool IsBearishSignal => Signal == SignalType.Bearish || Signal == SignalType.BearishT;
        public bool IsOverbought => RsiCondition == RsiCondition.Overbought;
        public bool IsOversold => RsiCondition == RsiCondition.Oversold;

        // Color helpers for binding
        public string NetChgColor => NetPctChg >= 0 ? "#00C853" : "#FF1744";
        public string MomentumColor => Momentum >= 0 ? "#00C853" : "#FF1744";
        public string PatternColor => PatternType switch
        {
            CandlestickPatternType.Bullish => "#00C853",
            CandlestickPatternType.Bearish => "#FF1744",
            _ => "#808080"
        };
        public string SignalBackground => Signal switch
        {
            SignalType.Bullish => "#00C853",
            SignalType.BullishT => "#FF6D00",
            SignalType.Bearish => "#D50000",
            SignalType.BearishT => "#AA00FF",
            _ => "Transparent"
        };
        public string RsiAlertBackground => RsiCondition switch
        {
            RsiCondition.Overbought => "#D50000",
            RsiCondition.Oversold => "#00C853",
            _ => "Transparent"
        };
    }

    public enum CandlestickPatternType
    {
        None,
        Bullish,
        Bearish
    }

    public enum SignalType
    {
        None,
        Bullish,
        BullishT,
        Bearish,
        BearishT
    }

    public enum RsiCondition
    {
        Normal,
        Overbought,
        Oversold
    }

    public static class CandlestickPatterns
    {
        public static readonly string[] BullishPatterns = new[]
        {
            "Hammer", "Inverted Hammer", "Bullish Engulfing", "Piercing Line",
            "Morning Star", "Three White Soldiers", "Bullish Harami",
            "Tweezer Bottoms", "Dragonfly Doji", "HangMan -"
        };

        public static readonly string[] BearishPatterns = new[]
        {
            "Hanging Man", "Shooting Star", "Bearish Engulfing", "Dark Cloud Cover",
            "Evening Star", "Three Black Crows", "Bearish Harami",
            "Tweezer Tops", "Gravestone Doji", "Doji - BearHarami -",
            "BearHarami -"
        };
    }
}
