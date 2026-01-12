using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public interface ISymbolService
    {
        Task<IEnumerable<SymbolMetadata>> SearchSymbolsAsync(string query, CancellationToken cancellationToken = default);
        Task<SymbolMetadata?> GetSymbolMetadataAsync(string symbol, CancellationToken cancellationToken = default);
        Task<StockQuote?> GetQuoteAsync(string symbol, CancellationToken cancellationToken = default);
        Task<IEnumerable<OhlcDataPoint>> GetHistoricalDataAsync(string symbol, TimeResolution resolution, DateTime start, DateTime end, CancellationToken cancellationToken = default);
        Task<IEnumerable<OhlcDataPoint>> GetRealtimeDataAsync(string symbol, TimeResolution resolution, CancellationToken cancellationToken = default);
        IEnumerable<string> GetSupportedResolutions();
        IEnumerable<string> GetPopularSymbols();
    }
}
