using System.Text.Json;
using JubileeBrowser.Models;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace JubileeBrowser.Services;

/// <summary>
/// Manages mobile device emulation for the browser.
/// Handles viewport manipulation, user agent spoofing, touch emulation, and network throttling.
/// </summary>
public class MobileEmulationManager
{
    private readonly Dictionary<string, MobileEmulationState> _tabEmulationStates = new();
    private readonly object _lock = new();

    /// <summary>
    /// Event fired when emulation state changes for a tab.
    /// </summary>
    public event EventHandler<MobileEmulationChangedEventArgs>? EmulationStateChanged;

    /// <summary>
    /// Gets the emulation state for a specific tab, creating a new one if it doesn't exist.
    /// </summary>
    public MobileEmulationState GetEmulationState(string tabId)
    {
        lock (_lock)
        {
            if (!_tabEmulationStates.TryGetValue(tabId, out var state))
            {
                state = new MobileEmulationState();
                _tabEmulationStates[tabId] = state;
            }
            return state;
        }
    }

    /// <summary>
    /// Removes emulation state for a tab (when tab is closed).
    /// </summary>
    public void RemoveTabState(string tabId)
    {
        lock (_lock)
        {
            _tabEmulationStates.Remove(tabId);
        }
    }

    /// <summary>
    /// Enables mobile emulation for a tab with a specific device profile.
    /// </summary>
    public async Task EnableEmulationAsync(string tabId, WebView2 webView, DeviceProfile device)
    {
        var state = GetEmulationState(tabId);
        state.IsEnabled = true;
        state.SelectedDevice = device;
        state.IsResponsiveMode = false;

        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Enables responsive mode with custom dimensions.
    /// </summary>
    public async Task EnableResponsiveModeAsync(string tabId, WebView2 webView, int width, int height, double dpr = 2.0)
    {
        var state = GetEmulationState(tabId);
        state.IsEnabled = true;
        state.IsResponsiveMode = true;
        state.CustomWidth = width;
        state.CustomHeight = height;
        state.CustomDevicePixelRatio = dpr;
        state.SelectedDevice = null;

        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Disables mobile emulation for a tab, restoring desktop mode.
    /// </summary>
    public async Task DisableEmulationAsync(string tabId, WebView2 webView)
    {
        var state = GetEmulationState(tabId);
        state.IsEnabled = false;

        await RemoveEmulationAsync(webView);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Toggles device orientation between portrait and landscape.
    /// </summary>
    public async Task ToggleOrientationAsync(string tabId, WebView2 webView)
    {
        var state = GetEmulationState(tabId);
        if (!state.IsEnabled) return;

        state.Orientation = state.Orientation == DeviceOrientation.Portrait
            ? DeviceOrientation.Landscape
            : DeviceOrientation.Portrait;

        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Sets a specific orientation.
    /// </summary>
    public async Task SetOrientationAsync(string tabId, WebView2 webView, DeviceOrientation orientation)
    {
        var state = GetEmulationState(tabId);
        if (!state.IsEnabled || state.Orientation == orientation) return;

        state.Orientation = orientation;
        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Sets network throttling for a tab.
    /// </summary>
    public async Task SetNetworkThrottlingAsync(string tabId, WebView2 webView, NetworkThrottlePreset preset)
    {
        var state = GetEmulationState(tabId);
        state.NetworkThrottle = preset;

        if (state.IsEnabled)
        {
            await ApplyNetworkThrottlingAsync(webView, preset);
        }
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Sets CPU throttling for a tab.
    /// </summary>
    public async Task SetCpuThrottlingAsync(string tabId, WebView2 webView, CpuThrottlePreset preset)
    {
        var state = GetEmulationState(tabId);
        state.CpuThrottle = preset;

        if (state.IsEnabled)
        {
            await ApplyCpuThrottlingAsync(webView, preset);
        }
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Updates custom responsive dimensions.
    /// </summary>
    public async Task UpdateResponsiveDimensionsAsync(string tabId, WebView2 webView, int width, int height)
    {
        var state = GetEmulationState(tabId);
        if (!state.IsEnabled || !state.IsResponsiveMode) return;

        state.CustomWidth = width;
        state.CustomHeight = height;

        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Updates custom device pixel ratio.
    /// </summary>
    public async Task UpdateDevicePixelRatioAsync(string tabId, WebView2 webView, double dpr)
    {
        var state = GetEmulationState(tabId);
        if (!state.IsEnabled || !state.IsResponsiveMode) return;

        state.CustomDevicePixelRatio = dpr;
        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Switches to a different device profile.
    /// </summary>
    public async Task SwitchDeviceAsync(string tabId, WebView2 webView, DeviceProfile device)
    {
        var state = GetEmulationState(tabId);
        if (!state.IsEnabled) return;

        state.SelectedDevice = device;
        state.IsResponsiveMode = false;

        await ApplyEmulationAsync(tabId, webView, state);
        OnEmulationStateChanged(tabId, state);
    }

    /// <summary>
    /// Applies the current emulation state to a WebView.
    /// </summary>
    private async Task ApplyEmulationAsync(string tabId, WebView2 webView, MobileEmulationState state)
    {
        if (webView?.CoreWebView2 == null) return;

        try
        {
            var effectiveWidth = state.EffectiveWidth;
            var effectiveHeight = state.EffectiveHeight;
            var dpr = state.EffectiveDevicePixelRatio;
            var hasTouch = state.SelectedDevice?.HasTouch ?? true;
            var isMobile = state.SelectedDevice?.IsMobile ?? true;
            var userAgent = state.SelectedDevice?.UserAgent ?? GetDefaultMobileUserAgent();
            var platform = state.SelectedDevice?.Platform ?? "iPhone";

            // Apply user agent override
            webView.CoreWebView2.Settings.UserAgent = userAgent;

            // Build and execute the emulation script
            var emulationScript = BuildEmulationScript(effectiveWidth, effectiveHeight, dpr, hasTouch, isMobile, platform);
            await webView.CoreWebView2.ExecuteScriptAsync(emulationScript);

            // Apply touch emulation script
            var touchScript = BuildTouchEmulationScript(hasTouch);
            await webView.CoreWebView2.ExecuteScriptAsync(touchScript);

            // Apply network throttling if set
            if (state.NetworkThrottle != NetworkThrottlePreset.None)
            {
                await ApplyNetworkThrottlingAsync(webView, state.NetworkThrottle);
            }

            // Apply CPU throttling if set
            if (state.CpuThrottle != CpuThrottlePreset.None)
            {
                await ApplyCpuThrottlingAsync(webView, state.CpuThrottle);
            }

            System.Diagnostics.Debug.WriteLine($"MobileEmulation: Applied emulation for tab {tabId} - {effectiveWidth}x{effectiveHeight}@{dpr}x");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"MobileEmulation: Error applying emulation: {ex.Message}");
        }
    }

    /// <summary>
    /// Removes emulation from a WebView, restoring desktop behavior.
    /// </summary>
    private async Task RemoveEmulationAsync(WebView2 webView)
    {
        if (webView?.CoreWebView2 == null) return;

        try
        {
            // Reset user agent to default
            webView.CoreWebView2.Settings.UserAgent = "";

            // Remove overridden properties
            var resetScript = @"
                (function() {
                    // Remove mobile viewport meta if we added it
                    var addedMeta = document.querySelector('meta[data-mobile-emulation]');
                    if (addedMeta) addedMeta.remove();

                    // Reset touch event simulation
                    if (window.__mobileEmulationCleanup) {
                        window.__mobileEmulationCleanup();
                        delete window.__mobileEmulationCleanup;
                    }

                    // Remove emulation marker
                    delete window.__mobileEmulationEnabled;

                    console.log('[Jubilee Browser] Mobile emulation disabled');
                })();
            ";
            await webView.CoreWebView2.ExecuteScriptAsync(resetScript);

            System.Diagnostics.Debug.WriteLine("MobileEmulation: Emulation disabled");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"MobileEmulation: Error removing emulation: {ex.Message}");
        }
    }

    /// <summary>
    /// Builds the JavaScript for mobile emulation.
    /// </summary>
    private string BuildEmulationScript(int width, int height, double dpr, bool hasTouch, bool isMobile, string platform)
    {
        // Escape strings for JavaScript
        var platformEscaped = JsonSerializer.Serialize(platform);

        return $@"
(function() {{
    // Mark emulation as enabled
    window.__mobileEmulationEnabled = true;

    // Override screen properties
    Object.defineProperty(window.screen, 'width', {{
        get: function() {{ return {width}; }},
        configurable: true
    }});
    Object.defineProperty(window.screen, 'height', {{
        get: function() {{ return {height}; }},
        configurable: true
    }});
    Object.defineProperty(window.screen, 'availWidth', {{
        get: function() {{ return {width}; }},
        configurable: true
    }});
    Object.defineProperty(window.screen, 'availHeight', {{
        get: function() {{ return {height}; }},
        configurable: true
    }});

    // Override window dimensions
    Object.defineProperty(window, 'innerWidth', {{
        get: function() {{ return {width}; }},
        configurable: true
    }});
    Object.defineProperty(window, 'innerHeight', {{
        get: function() {{ return {height}; }},
        configurable: true
    }});
    Object.defineProperty(window, 'outerWidth', {{
        get: function() {{ return {width}; }},
        configurable: true
    }});
    Object.defineProperty(window, 'outerHeight', {{
        get: function() {{ return {height}; }},
        configurable: true
    }});

    // Override device pixel ratio
    Object.defineProperty(window, 'devicePixelRatio', {{
        get: function() {{ return {dpr.ToString(System.Globalization.CultureInfo.InvariantCulture)}; }},
        configurable: true
    }});

    // Override navigator properties for mobile detection
    Object.defineProperty(navigator, 'maxTouchPoints', {{
        get: function() {{ return {(hasTouch ? "5" : "0")}; }},
        configurable: true
    }});
    Object.defineProperty(navigator, 'platform', {{
        get: function() {{ return {platformEscaped}; }},
        configurable: true
    }});

    // Add or update viewport meta tag for proper CSS media query handling
    var existingMeta = document.querySelector('meta[name=""viewport""]');
    var metaContent = 'width={width}, initial-scale=1, maximum-scale=5, user-scalable=yes';

    if (existingMeta) {{
        existingMeta.setAttribute('content', metaContent);
    }} else {{
        var meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = metaContent;
        meta.setAttribute('data-mobile-emulation', 'true');
        document.head.appendChild(meta);
    }}

    // Override matchMedia to properly respond to viewport changes
    var originalMatchMedia = window.matchMedia;
    window.matchMedia = function(query) {{
        // Handle common mobile-related media queries
        if (query.includes('max-width')) {{
            var match = query.match(/max-width:\s*(\d+)/);
            if (match) {{
                var maxWidth = parseInt(match[1]);
                var matches = {width} <= maxWidth;
                return {{
                    matches: matches,
                    media: query,
                    addListener: function(cb) {{ }},
                    removeListener: function(cb) {{ }},
                    addEventListener: function(type, cb) {{ }},
                    removeEventListener: function(type, cb) {{ }},
                    dispatchEvent: function(e) {{ return true; }}
                }};
            }}
        }}
        if (query.includes('min-width')) {{
            var match = query.match(/min-width:\s*(\d+)/);
            if (match) {{
                var minWidth = parseInt(match[1]);
                var matches = {width} >= minWidth;
                return {{
                    matches: matches,
                    media: query,
                    addListener: function(cb) {{ }},
                    removeListener: function(cb) {{ }},
                    addEventListener: function(type, cb) {{ }},
                    removeEventListener: function(type, cb) {{ }},
                    dispatchEvent: function(e) {{ return true; }}
                }};
            }}
        }}
        if (query.includes('orientation')) {{
            var isPortrait = {height} > {width};
            var matches = query.includes('portrait') ? isPortrait : !isPortrait;
            return {{
                matches: matches,
                media: query,
                addListener: function(cb) {{ }},
                removeListener: function(cb) {{ }},
                addEventListener: function(type, cb) {{ }},
                removeEventListener: function(type, cb) {{ }},
                dispatchEvent: function(e) {{ return true; }}
            }};
        }}
        // Fall back to original for other queries
        return originalMatchMedia.call(window, query);
    }};

    // Trigger resize event to force layout recalculation
    window.dispatchEvent(new Event('resize'));

    // Trigger orientation change if supported
    if ('onorientationchange' in window) {{
        window.dispatchEvent(new Event('orientationchange'));
    }}

    console.log('[Jubilee Browser] Mobile emulation enabled: {width}x{height}@{dpr.ToString(System.Globalization.CultureInfo.InvariantCulture)}x');
}})();
";
    }

    /// <summary>
    /// Builds the JavaScript for touch event emulation.
    /// </summary>
    private string BuildTouchEmulationScript(bool enableTouch)
    {
        if (!enableTouch)
        {
            return "/* Touch emulation disabled */";
        }

        return @"
(function() {
    if (window.__touchEmulationEnabled) return;
    window.__touchEmulationEnabled = true;

    // Track active touches
    var activeTouches = [];
    var touchId = 0;

    // Create a Touch-like object
    function createTouch(event, id, target) {
        return {
            identifier: id,
            target: target,
            clientX: event.clientX,
            clientY: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY,
            radiusX: 11.5,
            radiusY: 11.5,
            rotationAngle: 0,
            force: 1
        };
    }

    // Create TouchList-like object
    function createTouchList(touches) {
        var list = touches.slice();
        list.item = function(i) { return this[i] || null; };
        return list;
    }

    // Create TouchEvent
    function createTouchEvent(type, event, touches, targetTouches, changedTouches) {
        var touchEvent;
        try {
            touchEvent = new TouchEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                touches: touches,
                targetTouches: targetTouches,
                changedTouches: changedTouches
            });
        } catch (e) {
            // Fallback for browsers that don't support TouchEvent constructor
            touchEvent = document.createEvent('Event');
            touchEvent.initEvent(type, true, true);
            touchEvent.touches = touches;
            touchEvent.targetTouches = targetTouches;
            touchEvent.changedTouches = changedTouches;
        }
        return touchEvent;
    }

    var isDragging = false;
    var dragTarget = null;
    var currentTouchId = 0;

    function handleMouseDown(e) {
        if (e.button !== 0) return; // Only left click

        isDragging = true;
        dragTarget = e.target;
        currentTouchId = touchId++;

        var touch = createTouch(e, currentTouchId, e.target);
        activeTouches = [touch];

        var touchEvent = createTouchEvent('touchstart', e,
            createTouchList(activeTouches),
            createTouchList(activeTouches),
            createTouchList([touch])
        );

        e.target.dispatchEvent(touchEvent);
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        var touch = createTouch(e, currentTouchId, dragTarget);
        activeTouches = [touch];

        var touchEvent = createTouchEvent('touchmove', e,
            createTouchList(activeTouches),
            createTouchList(activeTouches),
            createTouchList([touch])
        );

        dragTarget.dispatchEvent(touchEvent);
    }

    function handleMouseUp(e) {
        if (!isDragging) return;

        var touch = createTouch(e, currentTouchId, dragTarget);

        var touchEvent = createTouchEvent('touchend', e,
            createTouchList([]),
            createTouchList([]),
            createTouchList([touch])
        );

        dragTarget.dispatchEvent(touchEvent);

        isDragging = false;
        dragTarget = null;
        activeTouches = [];
    }

    // Override pointer/touch detection
    if (!('ontouchstart' in window)) {
        window.ontouchstart = null;
    }

    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('mouseleave', handleMouseUp, true);

    // Store cleanup function
    window.__mobileEmulationCleanup = function() {
        document.removeEventListener('mousedown', handleMouseDown, true);
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseup', handleMouseUp, true);
        document.removeEventListener('mouseleave', handleMouseUp, true);
        delete window.__touchEmulationEnabled;
    };

    console.log('[Jubilee Browser] Touch emulation enabled');
})();
";
    }

    /// <summary>
    /// Applies network throttling via DevTools Protocol (when available).
    /// Note: Full network throttling requires CDP which may not be available in WebView2.
    /// This provides a simulated approach using JavaScript.
    /// </summary>
    private async Task ApplyNetworkThrottlingAsync(WebView2 webView, NetworkThrottlePreset preset)
    {
        if (webView?.CoreWebView2 == null) return;

        var config = NetworkThrottleConfig.GetPreset(preset);

        if (preset == NetworkThrottlePreset.Offline)
        {
            // Simulate offline mode by intercepting fetch/XHR
            var offlineScript = @"
(function() {
    if (window.__networkThrottleOffline) return;
    window.__networkThrottleOffline = true;

    var originalFetch = window.fetch;
    window.fetch = function() {
        return Promise.reject(new TypeError('Network request failed - Offline mode'));
    };

    var originalXHR = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function() {
        var xhr = this;
        setTimeout(function() {
            xhr.dispatchEvent(new Event('error'));
        }, 0);
    };

    console.log('[Jubilee Browser] Offline mode enabled');
})();
";
            await webView.CoreWebView2.ExecuteScriptAsync(offlineScript);
        }
        else if (preset == NetworkThrottlePreset.None)
        {
            // Remove throttling
            var resetScript = @"
(function() {
    delete window.__networkThrottleOffline;
    // Note: Cannot fully restore overridden fetch/XHR without page reload
    console.log('[Jubilee Browser] Network throttling disabled');
})();
";
            await webView.CoreWebView2.ExecuteScriptAsync(resetScript);
        }
        else
        {
            // For other presets, we simulate latency (full bandwidth throttling would require CDP)
            var latency = config.LatencyMs;
            var throttleScript = $@"
(function() {{
    if (window.__networkThrottleLatency) return;
    window.__networkThrottleLatency = {latency};

    var originalFetch = window.fetch;
    window.fetch = function() {{
        var args = arguments;
        return new Promise(function(resolve) {{
            setTimeout(function() {{
                resolve(originalFetch.apply(window, args));
            }}, {latency});
        }});
    }};

    console.log('[Jubilee Browser] Network throttling enabled: {config.Name} ({latency}ms latency)');
}})();
";
            await webView.CoreWebView2.ExecuteScriptAsync(throttleScript);
        }
    }

    /// <summary>
    /// Applies CPU throttling simulation.
    /// Note: True CPU throttling requires DevTools Protocol. This simulates the effect.
    /// </summary>
    private async Task ApplyCpuThrottlingAsync(WebView2 webView, CpuThrottlePreset preset)
    {
        if (webView?.CoreWebView2 == null) return;

        // CPU throttling simulation - adds artificial delays to requestAnimationFrame
        var multiplier = preset switch
        {
            CpuThrottlePreset.LowEnd2x => 2,
            CpuThrottlePreset.MidTier4x => 4,
            CpuThrottlePreset.LowTier6x => 6,
            _ => 1
        };

        if (multiplier > 1)
        {
            var throttleScript = $@"
(function() {{
    if (window.__cpuThrottleEnabled) return;
    window.__cpuThrottleEnabled = true;

    var multiplier = {multiplier};
    var originalRAF = window.requestAnimationFrame;
    var lastFrame = 0;
    var targetFrameTime = (1000 / 60) * multiplier; // Slow down frame rate

    window.requestAnimationFrame = function(callback) {{
        return originalRAF.call(window, function(timestamp) {{
            var elapsed = timestamp - lastFrame;
            if (elapsed >= targetFrameTime) {{
                lastFrame = timestamp;
                callback(timestamp);
            }} else {{
                originalRAF.call(window, function(ts) {{
                    callback(ts);
                }});
            }}
        }});
    }};

    console.log('[Jubilee Browser] CPU throttling enabled: {multiplier}x slowdown');
}})();
";
            await webView.CoreWebView2.ExecuteScriptAsync(throttleScript);
        }
        else
        {
            var resetScript = @"
(function() {
    delete window.__cpuThrottleEnabled;
    console.log('[Jubilee Browser] CPU throttling disabled');
})();
";
            await webView.CoreWebView2.ExecuteScriptAsync(resetScript);
        }
    }

    /// <summary>
    /// Gets the default mobile user agent string.
    /// </summary>
    private string GetDefaultMobileUserAgent()
    {
        return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    }

    /// <summary>
    /// Raises the EmulationStateChanged event.
    /// </summary>
    private void OnEmulationStateChanged(string tabId, MobileEmulationState state)
    {
        EmulationStateChanged?.Invoke(this, new MobileEmulationChangedEventArgs(tabId, state));
    }

    /// <summary>
    /// Re-applies emulation after navigation (some overrides may be lost on page load).
    /// </summary>
    public async Task ReapplyEmulationAfterNavigationAsync(string tabId, WebView2 webView)
    {
        var state = GetEmulationState(tabId);
        if (state.IsEnabled)
        {
            await ApplyEmulationAsync(tabId, webView, state);
        }
    }
}

/// <summary>
/// Event args for emulation state changes.
/// </summary>
public class MobileEmulationChangedEventArgs : EventArgs
{
    public string TabId { get; }
    public MobileEmulationState State { get; }

    public MobileEmulationChangedEventArgs(string tabId, MobileEmulationState state)
    {
        TabId = tabId;
        State = state;
    }
}
