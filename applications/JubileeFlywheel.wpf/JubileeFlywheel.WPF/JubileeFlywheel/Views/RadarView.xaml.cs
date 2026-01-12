using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel.Views
{
    public partial class RadarView : UserControl
    {
        private readonly ISymbolService _symbolService;
        private readonly ObservableCollection<RadarScreenItem> _radarItems;
        private ICollectionView _filteredView;

        public event EventHandler<string>? SymbolSelected;

        public RadarView()
        {
            InitializeComponent();

            _symbolService = App.ServiceProvider.GetRequiredService<ISymbolService>();
            _radarItems = new ObservableCollection<RadarScreenItem>();

            _filteredView = CollectionViewSource.GetDefaultView(_radarItems);
            RadarDataGrid.ItemsSource = _filteredView;

            Loaded += RadarView_Loaded;
        }

        private async void RadarView_Loaded(object sender, RoutedEventArgs e)
        {
            await LoadRadarDataAsync();
        }

        private async Task LoadRadarDataAsync()
        {
            _radarItems.Clear();

            var symbols = _symbolService.GetPopularSymbols().ToList();

            // Add more symbols for a fuller screen
            var moreSymbols = new[]
            {
                "ADBE", "ADP", "AEP", "AMAT", "AMD", "AMGN", "ANSS", "ASML", "ATVI",
                "AVGO", "AZN", "BIDU", "BIIB", "BKNG", "CDNS", "CHTR", "CMCSA",
                "CPRT", "CSCO", "CSX", "CTAS", "CTSH", "DXCM", "EA", "EBAY",
                "ENPH", "EXC", "FAST", "FISV", "GILD", "GOOG", "HON", "IDXX",
                "INTC", "INTU", "ISRG", "JD", "KDP"
            };

            symbols.AddRange(moreSymbols);

            var random = new Random();

            foreach (var symbol in symbols.Distinct().OrderBy(s => s))
            {
                var metadata = await _symbolService.GetSymbolMetadataAsync(symbol);
                var quote = await _symbolService.GetQuoteAsync(symbol);

                if (metadata != null && quote != null)
                {
                    var item = new RadarScreenItem
                    {
                        Symbol = symbol,
                        Description = metadata.Name,
                        Last = quote.Price,
                        NetChg = quote.Change,
                        NetPctChg = quote.ChangePercent,
                        Volume = quote.Volume,
                        Interval = "Daily",

                        // Generate simulated technical indicators
                        Macd = Math.Round((random.NextDouble() - 0.5) * 5, 2),
                        MacdDiff = Math.Round((random.NextDouble() - 0.5) * 2, 2),
                        Momentum = Math.Round((random.NextDouble() - 0.5) * 30, 2),
                        UpperBand = quote.Price * (1 + (decimal)(random.NextDouble() * 0.1)),
                        LowerBand = quote.Price * (1 - (decimal)(random.NextDouble() * 0.1)),
                        MacdRsDiff = Math.Round((random.NextDouble() - 0.5) * 2, 3),
                        XBarsAgo = random.Next(0, 50),
                        Rsi = Math.Round(30 + random.NextDouble() * 50, 2)
                    };

                    // Assign candlestick patterns randomly
                    if (random.NextDouble() > 0.7)
                    {
                        var patterns = random.NextDouble() > 0.5
                            ? CandlestickPatterns.BullishPatterns
                            : CandlestickPatterns.BearishPatterns;

                        item.CandlestickPattern = patterns[random.Next(patterns.Length)];
                        item.PatternType = random.NextDouble() > 0.5
                            ? CandlestickPatternType.Bullish
                            : CandlestickPatternType.Bearish;
                    }

                    // Assign signals randomly
                    if (random.NextDouble() > 0.6)
                    {
                        var signalRoll = random.NextDouble();
                        if (signalRoll < 0.25)
                        {
                            item.Signal = SignalType.Bullish;
                            item.SignalText = "Bullish";
                        }
                        else if (signalRoll < 0.5)
                        {
                            item.Signal = SignalType.BullishT;
                            item.SignalText = "Bullish T";
                        }
                        else if (signalRoll < 0.75)
                        {
                            item.Signal = SignalType.Bearish;
                            item.SignalText = "Bearish";
                        }
                        else
                        {
                            item.Signal = SignalType.BearishT;
                            item.SignalText = "Bearish T";
                        }
                    }

                    // RSI Conditions
                    if (item.Rsi > 70)
                    {
                        item.RsiCondition = RsiCondition.Overbought;
                        item.RsiAlert = "OverBought";
                    }
                    else if (item.Rsi < 30)
                    {
                        item.RsiCondition = RsiCondition.Oversold;
                        item.RsiAlert = "OverSold";
                    }
                    else
                    {
                        item.RsiCondition = RsiCondition.Normal;
                        item.RsiAlert = "OverBought"; // Demo shows most as overbought
                    }

                    _radarItems.Add(item);
                }
            }
        }

        private void SearchTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            var filterText = SearchTextBox.Text?.Trim().ToUpperInvariant();

            if (string.IsNullOrEmpty(filterText))
            {
                _filteredView.Filter = null;
            }
            else
            {
                _filteredView.Filter = item =>
                {
                    if (item is RadarScreenItem radarItem)
                    {
                        return radarItem.Symbol.Contains(filterText, StringComparison.OrdinalIgnoreCase) ||
                               radarItem.Description.Contains(filterText, StringComparison.OrdinalIgnoreCase);
                    }
                    return false;
                };
            }
        }

        private void RadarDataGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (RadarDataGrid.SelectedItem is RadarScreenItem item)
            {
                // Could update status or preview
            }
        }

        private void RadarDataGrid_MouseDoubleClick(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (RadarDataGrid.SelectedItem is RadarScreenItem item)
            {
                SymbolSelected?.Invoke(this, item.Symbol);
            }
        }

        private async void RefreshButton_Click(object sender, RoutedEventArgs e)
        {
            await LoadRadarDataAsync();
        }

        private void StudiesButton_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Studies configuration coming soon!", "Studies",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void DataButton_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Data source configuration coming soon!", "Data",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void SettingsButton_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Radar Screen settings coming soon!", "Settings",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }
}
