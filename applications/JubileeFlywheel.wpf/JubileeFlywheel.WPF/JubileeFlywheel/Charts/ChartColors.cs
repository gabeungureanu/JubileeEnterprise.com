using SkiaSharp;

namespace JubileeFlywheel.Charts;

/// <summary>
/// Chart color theme configuration
/// </summary>
public class ChartColors
{
    // Background colors
    public SKColor Background { get; set; } = new SKColor(0x00, 0x00, 0x00); // #000000
    public SKColor GridLines { get; set; } = new SKColor(0x1A, 0x1A, 0x1A); // #1A1A1A
    public SKColor GridLinesMajor { get; set; } = new SKColor(0x2A, 0x2A, 0x2A); // #2A2A2A

    // Candlestick colors
    public SKColor BullishBody { get; set; } = new SKColor(0x00, 0xC8, 0x53); // #00C853 Green
    public SKColor BullishWick { get; set; } = new SKColor(0x00, 0xC8, 0x53);
    public SKColor BullishOutline { get; set; } = new SKColor(0x00, 0xE6, 0x5F);
    public SKColor BearishBody { get; set; } = new SKColor(0xFF, 0x17, 0x44); // #FF1744 Red
    public SKColor BearishWick { get; set; } = new SKColor(0xFF, 0x17, 0x44);
    public SKColor BearishOutline { get; set; } = new SKColor(0xFF, 0x40, 0x60);

    // Line/Area colors
    public SKColor LineColor { get; set; } = new SKColor(0xFF, 0xBD, 0x59); // #FFBD59 Gold
    public SKColor AreaFill { get; set; } = new SKColor(0xFF, 0xBD, 0x59, 0x40);
    public SKColor AreaGradientTop { get; set; } = new SKColor(0xFF, 0xBD, 0x59, 0x60);
    public SKColor AreaGradientBottom { get; set; } = new SKColor(0xFF, 0xBD, 0x59, 0x10);

    // Scale colors
    public SKColor ScaleBackground { get; set; } = new SKColor(0x0D, 0x0D, 0x0D);
    public SKColor ScaleText { get; set; } = new SKColor(0xA0, 0xA0, 0xA0);
    public SKColor ScaleLine { get; set; } = new SKColor(0x2A, 0x2A, 0x2A);

    // Crosshair colors
    public SKColor CrosshairLine { get; set; } = new SKColor(0xFF, 0xBD, 0x59, 0xA0);
    public SKColor CrosshairBackground { get; set; } = new SKColor(0xFF, 0xBD, 0x59);
    public SKColor CrosshairText { get; set; } = new SKColor(0x00, 0x00, 0x00);

    // Volume colors
    public SKColor VolumeBullish { get; set; } = new SKColor(0x00, 0xC8, 0x53, 0x60);
    public SKColor VolumeBearish { get; set; } = new SKColor(0xFF, 0x17, 0x44, 0x60);

    // Selection/highlight
    public SKColor SelectionHighlight { get; set; } = new SKColor(0xFF, 0xBD, 0x59, 0x40);

    /// <summary>
    /// Get default dark theme colors
    /// </summary>
    public static ChartColors DarkTheme => new ChartColors();

    /// <summary>
    /// Get light theme colors
    /// </summary>
    public static ChartColors LightTheme => new ChartColors
    {
        Background = new SKColor(0xFF, 0xFF, 0xFF),
        GridLines = new SKColor(0xF0, 0xF0, 0xF0),
        GridLinesMajor = new SKColor(0xE0, 0xE0, 0xE0),
        BullishBody = new SKColor(0x00, 0x96, 0x88),
        BullishWick = new SKColor(0x00, 0x96, 0x88),
        BearishBody = new SKColor(0xE9, 0x1E, 0x63),
        BearishWick = new SKColor(0xE9, 0x1E, 0x63),
        ScaleBackground = new SKColor(0xF5, 0xF5, 0xF5),
        ScaleText = new SKColor(0x50, 0x50, 0x50),
        ScaleLine = new SKColor(0xE0, 0xE0, 0xE0),
        CrosshairLine = new SKColor(0x50, 0x50, 0x50, 0xA0),
        CrosshairBackground = new SKColor(0x50, 0x50, 0x50),
        CrosshairText = new SKColor(0xFF, 0xFF, 0xFF)
    };
}
