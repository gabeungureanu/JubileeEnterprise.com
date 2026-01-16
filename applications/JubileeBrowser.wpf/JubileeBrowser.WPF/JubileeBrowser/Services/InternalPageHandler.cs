using Microsoft.Web.WebView2.Core;
using System.Reflection;

namespace JubileeBrowser.Services;

public class InternalPageHandler
{
    private readonly Dictionary<string, Func<string?, string>> _pageGenerators = new();

    public InternalPageHandler()
    {
        RegisterDefaultPages();
    }

    private void RegisterDefaultPages()
    {
        _pageGenerators["settings"] = GenerateSettingsPage;
        _pageGenerators["about"] = GenerateAboutPage;
        _pageGenerators["blocked"] = GenerateBlockedPage;
        _pageGenerators["error"] = GenerateErrorPage;
        _pageGenerators["welcome"] = GenerateWelcomePage;
        _pageGenerators["history"] = GenerateHistoryPage;
        _pageGenerators["newtab"] = GenerateNewTabPage;
    }

    public bool CanHandle(string url)
    {
        return url.StartsWith("jubilee://", StringComparison.OrdinalIgnoreCase);
    }

    public string GetPageContent(string url)
    {
        try
        {
            var uri = new Uri(url);
            var pageName = uri.Host.ToLowerInvariant();
            var query = uri.Query;

            if (_pageGenerators.TryGetValue(pageName, out var generator))
            {
                return generator(query);
            }

            return Generate404Page(pageName);
        }
        catch
        {
            return GenerateErrorPage("Invalid URL");
        }
    }

    public async Task NavigateToInternalPage(CoreWebView2 webView, string url)
    {
        var content = GetPageContent(url);
        webView.NavigateToString(content);
    }

    private string GenerateSettingsPage(string? query)
    {
        var section = "general";
        if (!string.IsNullOrEmpty(query))
        {
            var parsed = System.Web.HttpUtility.ParseQueryString(query);
            section = parsed["section"] ?? "general";
        }

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Settings - Jubilee Browser</title>
    <style>
        /* ===== CSS Custom Properties (Design Tokens) ===== */
        /* Dark Theme (Default) */
        :root {{
            /* Primary Colors */
            --color-primary-text: #ffffff;
            --color-text-secondary: #a0a0a0;
            --color-text-muted: #6a6a7a;
            --color-accent-gold: #E6AC00;
            --color-accent-gold-hover: #F5C518;
            --color-accent-gold-pressed: #CC9800;
            --color-accent-red: #e94560;

            /* Background Colors */
            --color-bg-primary: #1a1a2e;
            --color-bg-secondary: #16213e;
            --color-bg-tertiary: #2a2a4e;
            --color-bg-hover: #3a3a5e;
            --color-bg-card: #1c1c33;
            --color-bg-input: #2a2a4e;

            /* Status Colors */
            --color-success: #4CAF50;
            --color-info: #2196F3;
            --color-error: #f44336;

            /* Border Colors */
            --color-border: rgba(255, 255, 255, 0.08);
            --color-border-focus: var(--color-accent-gold);

            /* Scrollbar Colors */
            --scrollbar-track: var(--color-bg-secondary);
            --scrollbar-thumb: var(--color-bg-tertiary);
            --scrollbar-thumb-hover: var(--color-accent-gold);

            /* Typography */
            --font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        }}

        /* Light Theme */
        :root[data-theme=""light""] {{
            /* Primary Colors */
            --color-primary-text: #1a1a2e;
            --color-text-secondary: #5c5c6e;
            --color-text-muted: #8a8a9a;
            --color-accent-gold: #B8860B;
            --color-accent-gold-hover: #D4A017;
            --color-accent-gold-pressed: #9A7209;
            --color-accent-red: #dc3545;

            /* Background Colors */
            --color-bg-primary: #f5f5f7;
            --color-bg-secondary: #ffffff;
            --color-bg-tertiary: #e8e8ed;
            --color-bg-hover: #d8d8de;
            --color-bg-card: #ffffff;
            --color-bg-input: #f0f0f5;

            /* Status Colors */
            --color-success: #28a745;
            --color-info: #17a2b8;
            --color-error: #dc3545;

            /* Border Colors */
            --color-border: rgba(0, 0, 0, 0.1);
            --color-border-focus: var(--color-accent-gold);

            /* Scrollbar Colors */
            --scrollbar-track: #e8e8ed;
            --scrollbar-thumb: #c8c8ce;
            --scrollbar-thumb-hover: var(--color-accent-gold);
        }}

        /* ===== Custom Scrollbar Styling ===== */
        /* WebKit browsers (Chrome, Safari, Edge) */
        ::-webkit-scrollbar {{
            width: 10px;
            height: 10px;
        }}
        ::-webkit-scrollbar-track {{
            background: var(--scrollbar-track);
            border-radius: 5px;
        }}
        ::-webkit-scrollbar-thumb {{
            background: var(--scrollbar-thumb);
            border-radius: 5px;
            border: 2px solid var(--scrollbar-track);
            transition: background 0.2s ease;
        }}
        ::-webkit-scrollbar-thumb:hover {{
            background: var(--scrollbar-thumb-hover);
        }}
        ::-webkit-scrollbar-corner {{
            background: var(--scrollbar-track);
        }}

        /* Firefox */
        * {{
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
        }}

        /* ===== Base Reset & Typography ===== */
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: var(--font-family);
            background: var(--color-bg-primary);
            color: var(--color-primary-text);
            min-height: 100vh;
            line-height: 1.5;
        }}

        /* ===== Layout ===== */
        .container {{
            display: flex;
            min-height: 100vh;
        }}

        /* ===== Sidebar ===== */
        .sidebar {{
            width: 280px;
            background: var(--color-bg-secondary);
            min-height: 100vh;
            padding: 20px 0;
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            overflow-y: auto;
        }}
        .sidebar h2 {{
            padding: 15px 24px;
            margin-bottom: 10px;
            font-size: 20px;
            color: var(--color-accent-gold);
            font-weight: 600;
        }}
        .sidebar-section {{
            padding: 8px 0;
        }}
        .sidebar-section-title {{
            padding: 8px 24px;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--color-accent-gold);
            letter-spacing: 0.5px;
            font-weight: 600;
            opacity: 0.8;
        }}
        .sidebar a {{
            display: flex;
            align-items: center;
            padding: 12px 24px;
            color: var(--color-primary-text);
            text-decoration: none;
            transition: all 0.15s ease;
            border-left: 3px solid transparent;
            font-weight: 400;
        }}
        .sidebar a:hover {{
            background: rgba(230, 172, 0, 0.1);
            color: var(--color-primary-text);
            border-left-color: rgba(230, 172, 0, 0.3);
        }}
        .sidebar a.active {{
            background: rgba(230, 172, 0, 0.15);
            color: var(--color-accent-gold);
            border-left-color: var(--color-accent-gold);
            font-weight: 500;
        }}
        .sidebar a .icon {{
            width: 20px;
            margin-right: 12px;
            text-align: center;
        }}

        /* ===== Main Content ===== */
        .content {{
            flex: 1;
            margin-left: 280px;
            padding: 40px 60px;
            max-width: 900px;
            overflow-y: auto;
        }}
        .content h1 {{
            margin-bottom: 8px;
            font-size: 32px;
            font-weight: 400;
            color: var(--color-primary-text);
        }}
        .content .subtitle {{
            color: var(--color-primary-text);
            margin-bottom: 32px;
            font-size: 14px;
            opacity: 0.85;
        }}

        /* ===== Search Box ===== */
        .search-box {{
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 32px;
            display: flex;
            align-items: center;
            transition: border-color 0.2s ease;
        }}
        .search-box:focus-within {{
            border-color: var(--color-border-focus);
        }}
        .search-box input {{
            background: transparent;
            border: none;
            color: var(--color-primary-text);
            font-size: 14px;
            flex: 1;
            outline: none;
        }}
        .search-box input::placeholder {{
            color: var(--color-primary-text);
            opacity: 0.5;
        }}
        .search-box .search-icon {{
            color: var(--color-accent-gold);
            margin-right: 12px;
        }}

        /* ===== Settings Groups ===== */
        .setting-group {{
            background: var(--color-bg-secondary);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
        }}
        .setting-group h3 {{
            margin-bottom: 20px;
            color: var(--color-accent-gold);
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }}
        .setting-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid var(--color-border);
        }}
        .setting-row:last-child {{
            border-bottom: none;
            padding-bottom: 0;
        }}
        .setting-row:first-child {{
            padding-top: 0;
        }}
        .setting-label {{
            display: flex;
            flex-direction: column;
            flex: 1;
            margin-right: 20px;
        }}
        .setting-label .title {{
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--color-primary-text);
        }}
        .setting-label .description {{
            color: var(--color-primary-text);
            font-size: 12px;
            line-height: 1.4;
            opacity: 0.75;
        }}

        /* ===== Form Controls ===== */
        input[type='text'], select {{
            background: var(--color-bg-primary);
            border: 1px solid var(--color-border);
            padding: 10px 14px;
            border-radius: 6px;
            color: var(--color-primary-text);
            min-width: 280px;
            font-size: 14px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }}
        input[type='text']:focus, select:focus {{
            outline: none;
            border-color: var(--color-border-focus);
            box-shadow: 0 0 0 2px rgba(230, 172, 0, 0.15);
        }}
        select option {{
            background: var(--color-bg-secondary);
            color: var(--color-primary-text);
        }}

        /* ===== Toggle Switch ===== */
        .toggle {{
            width: 48px;
            height: 26px;
            background: var(--color-bg-tertiary);
            border-radius: 13px;
            position: relative;
            cursor: pointer;
            transition: background 0.2s ease;
            flex-shrink: 0;
        }}
        .toggle:hover {{
            background: var(--color-bg-hover);
        }}
        .toggle.active {{
            background: var(--color-accent-gold);
        }}
        .toggle.active:hover {{
            background: #d49c00;
        }}
        .toggle::after {{
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            top: 3px;
            left: 3px;
            transition: transform 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }}
        .toggle.active::after {{
            transform: translateX(22px);
        }}

        /* Disabled toggle state */
        .toggle.disabled {{
            opacity: 0.4;
            cursor: not-allowed;
            pointer-events: none;
        }}
        .toggle.disabled:hover {{
            background: var(--color-bg-tertiary);
        }}
        .toggle.disabled.active {{
            background: rgba(230, 172, 0, 0.4);
        }}

        /* Setting row disabled state */
        .setting-row.disabled {{
            opacity: 0.5;
        }}
        .setting-row.disabled .setting-label {{
            opacity: 0.7;
        }}

        /* ===== Search Settings Input ===== */
        .search-settings-container {{
            margin-bottom: 20px;
        }}
        .search-settings-input {{
            position: relative;
            display: flex;
            align-items: center;
        }}
        .search-settings-input .search-icon {{
            position: absolute;
            left: 14px;
            width: 18px;
            height: 18px;
            color: var(--color-text-muted);
            pointer-events: none;
        }}
        .search-settings-input input {{
            width: 100%;
            padding: 12px 16px 12px 44px;
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            color: var(--color-text-primary);
            font-size: 14px;
            transition: all 0.2s ease;
        }}
        .search-settings-input input::placeholder {{
            color: var(--color-text-muted);
        }}
        .search-settings-input input:focus {{
            outline: none;
            border-color: var(--color-accent-gold);
            background: var(--color-bg-tertiary);
        }}

        /* ===== Sign In Notice ===== */
        .sync-sign-in-notice {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            background: rgba(230, 172, 0, 0.08);
            border: 1px solid rgba(230, 172, 0, 0.2);
            border-radius: 10px;
            margin-bottom: 20px;
        }}
        .sync-sign-in-notice .notice-icon {{
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(230, 172, 0, 0.15);
            border-radius: 50%;
        }}
        .sync-sign-in-notice .notice-icon svg {{
            width: 22px;
            height: 22px;
            color: var(--color-accent-gold);
        }}
        .sync-sign-in-notice .notice-content {{
            flex: 1;
        }}
        .sync-sign-in-notice .notice-title {{
            font-weight: 600;
            color: var(--color-text-primary);
            margin-bottom: 2px;
        }}
        .sync-sign-in-notice .notice-description {{
            font-size: 13px;
            color: var(--color-text-secondary);
        }}
        .btn-sm {{
            padding: 8px 16px;
            font-size: 13px;
        }}

        /* Setting row highlight for search */
        .setting-row.highlight {{
            background: rgba(230, 172, 0, 0.1);
            border-radius: 8px;
            margin: -8px -12px;
            padding: 8px 12px;
        }}
        .setting-row.hidden {{
            display: none !important;
        }}

        /* ===== Buttons ===== */
        .btn {{
            background: var(--color-accent-gold);
            color: var(--color-bg-primary);
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s ease, transform 0.1s ease;
        }}
        .btn:hover {{
            background: #d49c00;
        }}
        .btn:active {{
            transform: scale(0.98);
        }}
        .btn-secondary {{
            background: var(--color-bg-tertiary);
            color: var(--color-primary-text);
        }}
        .btn-secondary:hover {{
            background: var(--color-bg-hover);
        }}

        /* ===== Profile Card ===== */
        .profile-card {{
            display: flex;
            align-items: center;
            padding: 20px;
            background: var(--color-bg-primary);
            border-radius: 8px;
            margin-bottom: 16px;
        }}
        .profile-avatar {{
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-accent-red), var(--color-accent-gold));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 600;
            margin-right: 20px;
            color: var(--color-primary-text);
        }}
        .profile-info {{
            flex: 1;
        }}
        .profile-info .name {{
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--color-primary-text);
        }}
        .profile-info .email {{
            color: var(--color-primary-text);
            font-size: 13px;
            opacity: 0.85;
        }}

        /* ===== Sync Status ===== */
        .sync-status {{
            display: flex;
            align-items: center;
            color: var(--color-success);
            font-size: 13px;
        }}
        .sync-status.syncing {{
            color: var(--color-info);
        }}
        .sync-status.error {{
            color: var(--color-error);
        }}
        .sync-status .dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
            margin-right: 8px;
        }}

        /* ===== Section Visibility ===== */
        .section {{ display: none; }}
        .section.active {{ display: block; }}

        /* ===== Loading State ===== */
        .loading {{
            text-align: center;
            padding: 40px;
            color: var(--color-primary-text);
            opacity: 0.7;
        }}

        /* ===== Saved Indicator ===== */
        .saved-indicator {{
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--color-accent-gold);
            color: var(--color-bg-primary);
            padding: 12px 24px;
            border-radius: 8px;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            z-index: 1000;
            font-weight: 500;
            transform: translateY(10px);
        }}
        .saved-indicator.show {{
            opacity: 1;
            transform: translateY(0);
        }}

        /* ===== Custom Modal ===== */
        .modal-overlay {{
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
        }}
        .modal-overlay.show {{
            opacity: 1;
            visibility: visible;
        }}
        .modal-card {{
            background: var(--color-bg-primary);
            border-radius: 12px;
            min-width: 360px;
            max-width: 440px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            transform: scale(0.9) translateY(-20px);
            transition: transform 0.2s ease;
            overflow: hidden;
        }}
        .modal-overlay.show .modal-card {{
            transform: scale(1) translateY(0);
        }}
        .modal-header {{
            background: #0f0f1a;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
        }}
        .modal-icon {{
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: linear-gradient(135deg, var(--color-accent-gold), #d49c00);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }}
        .modal-icon.warning {{
            background: linear-gradient(135deg, #ff9800, #f57c00);
        }}
        .modal-title {{
            font-size: 18px;
            font-weight: 600;
            color: var(--color-primary-text);
            flex: 1;
        }}
        .modal-close {{
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            color: #a0a0a0;
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: background 0.15s ease, color 0.15s ease;
        }}
        .modal-close:hover {{
            background: var(--color-bg-tertiary);
            color: var(--color-primary-text);
        }}
        .modal-body {{
            padding: 20px 24px 24px;
        }}
        .modal-message-primary {{
            font-size: 15px;
            font-weight: 500;
            color: var(--color-primary-text);
            margin-bottom: 8px;
            line-height: 1.5;
        }}
        .modal-message-secondary {{
            font-size: 14px;
            color: var(--color-primary-text);
            opacity: 0.7;
            line-height: 1.5;
        }}
        .modal-footer {{
            background: #0f0f1a;
            padding: 14px 20px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }}
        .modal-btn {{
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            min-width: 100px;
            transition: background 0.15s ease, transform 0.1s ease;
        }}
        .modal-btn:active {{
            transform: scale(0.98);
        }}
        .modal-btn-secondary {{
            background: var(--color-bg-tertiary);
            color: var(--color-primary-text);
        }}
        .modal-btn-secondary:hover {{
            background: var(--color-bg-hover);
        }}
        .modal-btn-primary {{
            background: var(--color-accent-gold);
            color: var(--color-bg-primary);
        }}
        .modal-btn-primary:hover {{
            background: #d49c00;
        }}
        .modal-btn-danger {{
            background: var(--color-accent-red);
            color: white;
        }}
        .modal-btn-danger:hover {{
            background: #d13a55;
        }}

        /* ===== Accessibility: Focus Visible ===== */
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, .toggle:focus-visible {{
            outline: 2px solid var(--color-accent-gold);
            outline-offset: 2px;
        }}

        /* ===== Responsive Adjustments ===== */
        @media (max-width: 900px) {{
            .content {{
                padding: 30px 40px;
            }}
            input[type='text'], select {{
                min-width: 200px;
            }}
        }}
        @media (max-width: 700px) {{
            .sidebar {{
                width: 240px;
            }}
            .content {{
                margin-left: 240px;
                padding: 20px 30px;
            }}
        }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='sidebar'>
            <h2>Settings</h2>
            <div class='sidebar-section'>
                <a href='#' data-section='profile' class='{(section == "profile" ? "active" : "")}'><span class='icon'>👤</span>You and Jubilee</a>
                <a href='#' data-section='sync' class='{(section == "sync" ? "active" : "")}'><span class='icon'>🔄</span>Sync</a>
            </div>
            <div class='sidebar-section'>
                <div class='sidebar-section-title'>Browser</div>
                <a href='#' data-section='general' class='{(section == "general" ? "active" : "")}'><span class='icon'>⚙️</span>General</a>
                <a href='#' data-section='appearance' class='{(section == "appearance" ? "active" : "")}'><span class='icon'>🎨</span>Appearance</a>
                <a href='#' data-section='search' class='{(section == "search" ? "active" : "")}'><span class='icon'>🔍</span>Search Engine</a>
                <a href='#' data-section='startup' class='{(section == "startup" ? "active" : "")}'><span class='icon'>🚀</span>On Startup</a>
            </div>
            <div class='sidebar-section'>
                <div class='sidebar-section-title'>Privacy & Security</div>
                <a href='#' data-section='privacy' class='{(section == "privacy" ? "active" : "")}'><span class='icon'>🔒</span>Privacy</a>
                <a href='#' data-section='permissions' class='{(section == "permissions" ? "active" : "")}'><span class='icon'>🛡️</span>Site Permissions</a>
            </div>
            <div class='sidebar-section'>
                <div class='sidebar-section-title'>Advanced</div>
                <a href='#' data-section='downloads' class='{(section == "downloads" ? "active" : "")}'><span class='icon'>📥</span>Downloads</a>
                <a href='#' data-section='advanced' class='{(section == "advanced" ? "active" : "")}'><span class='icon'>🔧</span>System</a>
            </div>
            <div class='sidebar-section'>
                <a href='jubilee://about'><span class='icon'>ℹ️</span>About Jubilee</a>
            </div>
        </div>
        <div class='content'>
            <div class='search-box'>
                <span class='search-icon'>🔍</span>
                <input type='text' placeholder='Search settings...' id='searchInput'>
            </div>

            <!-- Profile Section -->
            <div class='section {(section == "profile" ? "active" : "")}' id='section-profile'>
                <h1>You and Jubilee</h1>
                <p class='subtitle'>Manage your profile and account settings</p>

                <div class='setting-group' id='profile-card-container'>
                    <div class='profile-card' id='profileCard'>
                        <div class='profile-avatar' id='profileAvatar'>?</div>
                        <div class='profile-info'>
                            <div class='name' id='profileName'>Loading...</div>
                            <div class='email' id='profileEmail'>Loading...</div>
                        </div>
                        <button class='btn btn-secondary' id='manageAccountBtn'>Manage Account</button>
                    </div>
                    <div class='sync-status' id='syncStatus'>
                        <span class='dot'></span>
                        <span id='syncStatusText'>Checking sync status...</span>
                    </div>
                </div>

                <!-- Profile Actions - Signed In State (hidden until auth state is checked) -->
                <div class='setting-group' id='profileActionsSignedIn' style='display: none;'>
                    <h3>Profile Actions</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sign out</div>
                            <div class='description'>Sign out of your Jubilee account on this device</div>
                        </div>
                        <button class='btn btn-secondary' id='signOutBtn'>Sign Out</button>
                    </div>
                </div>

                <!-- Profile Actions - Signed Out State (hidden until auth state is checked) -->
                <div class='setting-group' id='profileActionsSignedOut' style='display: none;'>
                    <h3>Get Started</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sign in to Jubilee</div>
                            <div class='description'>Sign in to sync your bookmarks, history, and settings across devices</div>
                        </div>
                        <button class='btn btn-primary' id='signInBtn'>Sign In</button>
                    </div>
                </div>
            </div>

            <!-- Sync Section -->
            <div class='section {(section == "sync" ? "active" : "")}' id='section-sync'>
                <h1>Sync</h1>
                <p class='subtitle'>Sync your data across devices</p>

                <!-- Search Settings -->
                <div class='search-settings-container'>
                    <div class='search-settings-input'>
                        <svg class='search-icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
                            <circle cx='11' cy='11' r='8'/>
                            <path d='m21 21-4.35-4.35'/>
                        </svg>
                        <input type='text' id='syncSearchInput' placeholder='Search sync settings' />
                    </div>
                </div>

                <!-- Sign In Required Notice (shown when not signed in) -->
                <div class='sync-sign-in-notice' id='syncSignInNotice' style='display: none;'>
                    <div class='notice-icon'>
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
                            <path d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'/>
                        </svg>
                    </div>
                    <div class='notice-content'>
                        <div class='notice-title'>Sign in to enable sync</div>
                        <div class='notice-description'>Sign in to your Jubilee account to sync your data across all your devices.</div>
                    </div>
                    <button class='btn btn-primary btn-sm' id='syncSignInBtn'>Sign In</button>
                </div>

                <div class='setting-group' id='syncSettingsGroup'>
                    <h3>Sync Settings</h3>
                    <div class='setting-row sync-setting-row' data-search-terms='bookmarks favorites saved pages'>
                        <div class='setting-label'>
                            <div class='title'>Sync bookmarks</div>
                            <div class='description'>Keep your bookmarks in sync across all your devices</div>
                        </div>
                        <div class='toggle sync-toggle' data-setting='sync.bookmarks' id='syncBookmarks' tabindex='0'></div>
                    </div>
                    <div class='setting-row sync-setting-row' data-search-terms='history browsing visited'>
                        <div class='setting-label'>
                            <div class='title'>Sync history</div>
                            <div class='description'>Sync your browsing history</div>
                        </div>
                        <div class='toggle sync-toggle' data-setting='sync.history' id='syncHistory' tabindex='0'></div>
                    </div>
                    <div class='setting-row sync-setting-row' data-search-terms='passwords credentials login security'>
                        <div class='setting-label'>
                            <div class='title'>Sync passwords</div>
                            <div class='description'>Sync saved passwords (encrypted)</div>
                        </div>
                        <div class='toggle sync-toggle' data-setting='sync.passwords' id='syncPasswords' tabindex='0'></div>
                    </div>
                    <div class='setting-row sync-setting-row' data-search-terms='settings preferences configuration options'>
                        <div class='setting-label'>
                            <div class='title'>Sync settings</div>
                            <div class='description'>Sync your browser settings</div>
                        </div>
                        <div class='toggle sync-toggle' data-setting='sync.settings' id='syncSettings' tabindex='0'></div>
                    </div>
                </div>
            </div>

            <!-- General Section -->
            <div class='section {(section == "general" ? "active" : "")}' id='section-general'>
                <h1>General</h1>
                <p class='subtitle'>Basic browser settings</p>

                <div class='setting-group'>
                    <h3>Homepage</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Internet Mode Homepage</div>
                            <div class='description'>The page shown when you open a new tab in Internet mode</div>
                        </div>
                        <input type='text' data-setting='homepage.internet' id='homepageInternet' placeholder='https://www.google.com'>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Jubilee Bibles Homepage</div>
                            <div class='description'>The page shown when you open a new tab in Jubilee Bibles mode</div>
                        </div>
                        <input type='text' data-setting='homepage.jubileeBibles' id='homepageJubileeBibles' placeholder='inspire://jubilee.inspire'>
                    </div>
                </div>

                <div class='setting-group'>
                    <h3>Default Mode</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Start in Jubilee Bibles mode</div>
                            <div class='description'>Open new windows in Jubilee Bibles mode by default</div>
                        </div>
                        <div class='toggle' data-setting='defaultMode' id='defaultModeToggle'></div>
                    </div>
                </div>
            </div>

            <!-- Appearance Section -->
            <div class='section {(section == "appearance" ? "active" : "")}' id='section-appearance'>
                <h1>Appearance</h1>
                <p class='subtitle'>Customize how Jubilee Browser looks</p>

                <div class='setting-group'>
                    <h3>Theme</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Color scheme</div>
                            <div class='description'>Choose between dark and light themes</div>
                        </div>
                        <select data-setting='appearance.theme' id='themeSelect'>
                            <option value='dark'>Dark</option>
                            <option value='light'>Light</option>
                            <option value='system'>System default</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Show bookmarks bar</div>
                            <div class='description'>Display the bookmarks bar below the address bar</div>
                        </div>
                        <div class='toggle' data-setting='appearance.showBookmarksBar' id='showBookmarksBar'></div>
                    </div>
                </div>

                <div class='setting-group'>
                    <h3>Font</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Font size</div>
                            <div class='description'>Default font size for web pages</div>
                        </div>
                        <select data-setting='appearance.fontSize' id='fontSizeSelect'>
                            <option value='12'>Very small</option>
                            <option value='14'>Small</option>
                            <option value='16'>Medium (Recommended)</option>
                            <option value='18'>Large</option>
                            <option value='20'>Very large</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Search Section -->
            <div class='section {(section == "search" ? "active" : "")}' id='section-search'>
                <h1>Search Engine</h1>
                <p class='subtitle'>Choose your default search engine</p>

                <div class='setting-group'>
                    <h3>Default Search Engine</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Search engine used in the address bar</div>
                            <div class='description'>Searches from the address bar will use this engine</div>
                        </div>
                        <select data-setting='search.defaultEngine' id='searchEngineSelect'>
                            <option value='google'>Google</option>
                            <option value='bing'>Bing</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Search suggestions</div>
                            <div class='description'>Show search suggestions as you type</div>
                        </div>
                        <div class='toggle' data-setting='search.suggestionsEnabled' id='searchSuggestions'></div>
                    </div>
                </div>
            </div>

            <!-- Privacy Section -->
            <div class='section {(section == "privacy" ? "active" : "")}' id='section-privacy'>
                <h1>Privacy</h1>
                <p class='subtitle'>Control your privacy settings</p>

                <div class='setting-group'>
                    <h3>Tracking Protection</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Tracking prevention</div>
                            <div class='description'>Block trackers from following you across websites</div>
                        </div>
                        <div class='toggle active' data-setting='privacy.trackingProtection' id='trackingProtection'></div>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Send ""Do Not Track"" requests</div>
                            <div class='description'>Ask websites not to track your browsing</div>
                        </div>
                        <div class='toggle' data-setting='privacy.doNotTrack' id='doNotTrack'></div>
                    </div>
                </div>

                <div class='setting-group'>
                    <h3>Browsing Data</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Clear browsing data on exit</div>
                            <div class='description'>Automatically clear history, cookies, and cache when you close the browser</div>
                        </div>
                        <div class='toggle' data-setting='privacy.clearOnExit' id='clearOnExit'></div>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Clear browsing data</div>
                            <div class='description'>Clear history, cookies, cached images and files</div>
                        </div>
                        <button class='btn btn-secondary' id='clearDataBtn'>Clear Data...</button>
                    </div>
                </div>
            </div>

            <!-- Downloads Section -->
            <div class='section {(section == "downloads" ? "active" : "")}' id='section-downloads'>
                <h1>Downloads</h1>
                <p class='subtitle'>Manage download settings</p>

                <div class='setting-group'>
                    <h3>Download Location</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Download folder</div>
                            <div class='description'>Where downloaded files are saved</div>
                        </div>
                        <input type='text' data-setting='advanced.downloadPath' id='downloadPath' readonly style='cursor: pointer;'>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Ask where to save each file</div>
                            <div class='description'>Choose the download location for each file</div>
                        </div>
                        <div class='toggle' data-setting='advanced.askDownloadLocation' id='askDownloadLocation'></div>
                    </div>
                </div>
            </div>

            <!-- Advanced Section -->
            <div class='section {(section == "advanced" ? "active" : "")}' id='section-advanced'>
                <h1>System</h1>
                <p class='subtitle'>Advanced browser settings</p>

                <div class='setting-group'>
                    <h3>Performance</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Hardware acceleration</div>
                            <div class='description'>Use hardware acceleration when available for better performance</div>
                        </div>
                        <div class='toggle active' data-setting='advanced.hardwareAcceleration' id='hardwareAcceleration'></div>
                    </div>
                </div>

                <div class='setting-group'>
                    <h3>Language</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Spell check</div>
                            <div class='description'>Check spelling as you type</div>
                        </div>
                        <div class='toggle active' data-setting='advanced.spellcheck' id='spellcheck'></div>
                    </div>
                </div>

                <div class='setting-group'>
                    <h3>Reset</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Restore settings to defaults</div>
                            <div class='description'>Reset all settings to their original defaults</div>
                        </div>
                        <button class='btn btn-secondary' id='resetSettingsBtn'>Reset Settings</button>
                    </div>
                </div>
            </div>

            <!-- Permissions Section -->
            <div class='section {(section == "permissions" ? "active" : "")}' id='section-permissions'>
                <h1>Site Permissions</h1>
                <p class='subtitle'>Control what sites can access</p>

                <div class='setting-group'>
                    <h3>Default Permissions</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Camera</div>
                            <div class='description'>Allow sites to use your camera</div>
                        </div>
                        <select data-setting='permissions.camera' id='permCamera'>
                            <option value='ask'>Ask (Recommended)</option>
                            <option value='allow'>Allow</option>
                            <option value='block'>Block</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Microphone</div>
                            <div class='description'>Allow sites to use your microphone</div>
                        </div>
                        <select data-setting='permissions.microphone' id='permMicrophone'>
                            <option value='ask'>Ask (Recommended)</option>
                            <option value='allow'>Allow</option>
                            <option value='block'>Block</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Location</div>
                            <div class='description'>Allow sites to access your location</div>
                        </div>
                        <select data-setting='permissions.location' id='permLocation'>
                            <option value='ask'>Ask (Recommended)</option>
                            <option value='allow'>Allow</option>
                            <option value='block'>Block</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Notifications</div>
                            <div class='description'>Allow sites to send you notifications</div>
                        </div>
                        <select data-setting='permissions.notifications' id='permNotifications'>
                            <option value='ask'>Ask</option>
                            <option value='allow'>Allow</option>
                            <option value='block'>Block (Recommended)</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Pop-ups</div>
                            <div class='description'>Allow sites to open pop-up windows</div>
                        </div>
                        <select data-setting='permissions.popups' id='permPopups'>
                            <option value='block'>Block (Recommended)</option>
                            <option value='allow'>Allow</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Startup Section -->
            <div class='section {(section == "startup" ? "active" : "")}' id='section-startup'>
                <h1>On Startup</h1>
                <p class='subtitle'>Choose what happens when you open the browser</p>

                <div class='setting-group'>
                    <h3>Startup Behavior</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Internet mode startup</div>
                            <div class='description'>What to show when starting in Internet mode</div>
                        </div>
                        <select data-setting='startup.internet' id='startupInternet'>
                            <option value='homepage'>Open homepage</option>
                            <option value='newtab'>Open new tab page</option>
                            <option value='continue'>Continue where you left off</option>
                        </select>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Jubilee Bibles mode startup</div>
                            <div class='description'>What to show when starting in Jubilee Bibles mode</div>
                        </div>
                        <select data-setting='startup.jubileeBibles' id='startupJubileeBibles'>
                            <option value='homepage'>Open homepage</option>
                            <option value='newtab'>Open new tab page</option>
                            <option value='continue'>Continue where you left off</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='saved-indicator' id='savedIndicator'>Settings saved</div>

    <!-- Custom Confirmation Modal -->
    <div class='modal-overlay' id='confirmModal'>
        <div class='modal-card'>
            <div class='modal-header'>
                <div class='modal-icon warning' id='modalIcon'>⚠️</div>
                <div class='modal-title' id='modalTitle'>Confirm</div>
                <button class='modal-close' id='modalClose'>✕</button>
            </div>
            <div class='modal-body'>
                <div class='modal-message-primary' id='modalMessagePrimary'>Are you sure?</div>
                <div class='modal-message-secondary' id='modalMessageSecondary'></div>
            </div>
            <div class='modal-footer'>
                <button class='modal-btn modal-btn-secondary' id='modalCancelBtn'>Cancel</button>
                <button class='modal-btn modal-btn-primary' id='modalConfirmBtn'>Confirm</button>
            </div>
        </div>
    </div>

    <script>
        // Settings state
        let settings = {{}};
        let profileInfo = null;
        let syncPrefs = null;

        // Initialize
        document.addEventListener('DOMContentLoaded', async function() {{
            // Set up navigation
            document.querySelectorAll('.sidebar a[data-section]').forEach(link => {{
                link.addEventListener('click', function(e) {{
                    e.preventDefault();
                    const section = this.dataset.section;
                    showSection(section);
                }});
            }});

            // Load settings from browser
            await loadSettings();
            await loadProfileInfo();
            await loadSyncPreferences();
        }});

        function showSection(sectionId) {{
            // Update sidebar
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            const activeLink = document.querySelector(`.sidebar a[data-section='${{sectionId}}']`);
            if (activeLink) activeLink.classList.add('active');

            // Update content
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const section = document.getElementById('section-' + sectionId);
            if (section) section.classList.add('active');

            // Update URL without navigation
            history.pushState(null, '', 'jubilee://settings?section=' + sectionId);
        }}

        async function loadSettings() {{
            try {{
                if (window.jubilee) {{
                    settings = await window.jubilee.invoke('settings:getAll');
                    applySettingsToUI(settings);
                }}
            }} catch (e) {{
                console.error('Failed to load settings:', e);
            }}
        }}

        async function loadProfileInfo() {{
            try {{
                if (window.jubilee) {{
                    profileInfo = await window.jubilee.invoke('profile:getInfo');
                    updateProfileUI(profileInfo);
                }}
            }} catch (e) {{
                console.error('Failed to load profile:', e);
                updateProfileUI(null);
            }}
        }}

        async function loadSyncPreferences() {{
            try {{
                if (window.jubilee) {{
                    syncPrefs = await window.jubilee.invoke('sync:getPreferences');
                    applySyncPrefsToUI(syncPrefs);
                }}
            }} catch (e) {{
                console.error('Failed to load sync prefs:', e);
            }}
        }}

        // ===== Theme Switching Functions =====
        let currentTheme = 'dark';
        const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        function applyTheme(theme) {{
            currentTheme = theme;
            let effectiveTheme = theme;

            if (theme === 'system') {{
                effectiveTheme = systemThemeMediaQuery.matches ? 'dark' : 'light';
            }}

            if (effectiveTheme === 'light') {{
                document.documentElement.dataset.theme = 'light';
            }} else {{
                delete document.documentElement.dataset.theme;
            }}

            // Notify parent window of theme change for WPF synchronization
            if (window.jubilee) {{
                window.jubilee.send('theme:applied', {{ theme: theme, effectiveTheme: effectiveTheme }});
            }}
        }}

        // Listen for system theme changes
        systemThemeMediaQuery.addEventListener('change', (e) => {{
            if (currentTheme === 'system') {{
                applyTheme('system');
            }}
        }});

        // Global function to receive theme updates from WPF
        window.setTheme = function(theme) {{
            applyTheme(theme);
            setSelectValue('themeSelect', theme);
        }};

        function applySettingsToUI(s) {{
            if (!s) return;

            // Apply theme first for immediate visual feedback
            if (s.appearance?.theme) {{
                applyTheme(s.appearance.theme);
            }}

            // Homepage
            setInputValue('homepageInternet', s.homepage?.internet);
            setInputValue('homepageJubileeBibles', s.homepage?.jubileeBibles);

            // Default mode
            setToggle('defaultModeToggle', s.defaultMode === 1);

            // Appearance
            setSelectValue('themeSelect', s.appearance?.theme);
            setSelectValue('fontSizeSelect', s.appearance?.fontSize?.toString());
            setToggle('showBookmarksBar', s.appearance?.showBookmarksBar);

            // Search
            setSelectValue('searchEngineSelect', s.search?.defaultEngine);
            setToggle('searchSuggestions', s.search?.suggestionsEnabled);

            // Privacy
            setToggle('trackingProtection', s.privacy?.trackingProtection);
            setToggle('doNotTrack', s.privacy?.doNotTrack);
            setToggle('clearOnExit', s.privacy?.clearOnExit);

            // Downloads
            setInputValue('downloadPath', s.advanced?.downloadPath);
            setToggle('askDownloadLocation', s.advanced?.askDownloadLocation);

            // Advanced
            setToggle('hardwareAcceleration', s.advanced?.hardwareAcceleration);
            setToggle('spellcheck', s.advanced?.spellcheck);

            // Permissions
            setSelectValue('permCamera', s.permissions?.camera);
            setSelectValue('permMicrophone', s.permissions?.microphone);
            setSelectValue('permLocation', s.permissions?.location);
            setSelectValue('permNotifications', s.permissions?.notifications);
            setSelectValue('permPopups', s.permissions?.popups);

            // Startup
            setSelectValue('startupInternet', s.startup?.internet);
            setSelectValue('startupJubileeBibles', s.startup?.jubileeBibles);
        }}

        function applySyncPrefsToUI(prefs) {{
            if (!prefs) return;
            setToggle('syncBookmarks', prefs.syncBookmarks);
            setToggle('syncHistory', prefs.syncHistory);
            setToggle('syncPasswords', prefs.syncPasswords);
            setToggle('syncSettings', prefs.syncSettings);
        }}

        function updateProfileUI(info) {{
            const avatar = document.getElementById('profileAvatar');
            const name = document.getElementById('profileName');
            const email = document.getElementById('profileEmail');
            const syncStatus = document.getElementById('syncStatusText');
            const syncContainer = document.getElementById('syncStatus');
            const manageAccountBtn = document.getElementById('manageAccountBtn');
            const profileActionsSignedIn = document.getElementById('profileActionsSignedIn');
            const profileActionsSignedOut = document.getElementById('profileActionsSignedOut');

            if (info && info.isSignedIn) {{
                avatar.textContent = (info.displayName || info.email || '?')[0].toUpperCase();
                name.textContent = info.displayName || 'Jubilee User';
                email.textContent = info.email || '';

                // Show signed-in UI elements
                if (manageAccountBtn) manageAccountBtn.style.display = 'inline-flex';
                if (profileActionsSignedIn) profileActionsSignedIn.style.display = 'block';
                if (profileActionsSignedOut) profileActionsSignedOut.style.display = 'none';

                if (info.syncStatus === 'syncing') {{
                    syncContainer.className = 'sync-status syncing';
                    syncStatus.textContent = 'Syncing...';
                }} else if (info.syncStatus === 'error') {{
                    syncContainer.className = 'sync-status error';
                    syncStatus.textContent = 'Sync error';
                }} else {{
                    syncContainer.className = 'sync-status';
                    syncStatus.textContent = info.lastSyncTime ? 'Synced ' + info.lastSyncTime : 'Sync is on';
                }}
                // Enable sync toggles
                updateSyncTogglesState(true);
            }} else {{
                avatar.textContent = '?';
                name.textContent = 'Not signed in';
                email.textContent = 'Sign in to sync your data';
                syncContainer.className = 'sync-status';
                syncStatus.textContent = 'Sign in to enable sync';

                // Show signed-out UI elements
                if (manageAccountBtn) manageAccountBtn.style.display = 'none';
                if (profileActionsSignedIn) profileActionsSignedIn.style.display = 'none';
                if (profileActionsSignedOut) profileActionsSignedOut.style.display = 'block';

                // Disable sync toggles
                updateSyncTogglesState(false);
            }}
        }}

        // Track current auth state for sync toggles
        let isUserSignedIn = false;

        function updateSyncTogglesState(enabled) {{
            isUserSignedIn = enabled;
            const syncToggles = document.querySelectorAll('.sync-toggle');
            const syncSettingRows = document.querySelectorAll('.sync-setting-row');
            const signInNotice = document.getElementById('syncSignInNotice');

            syncToggles.forEach(toggle => {{
                if (enabled) {{
                    toggle.classList.remove('disabled');
                    toggle.setAttribute('tabindex', '0');
                }} else {{
                    toggle.classList.add('disabled');
                    toggle.setAttribute('tabindex', '-1');
                }}
            }});

            syncSettingRows.forEach(row => {{
                if (enabled) {{
                    row.classList.remove('disabled');
                }} else {{
                    row.classList.add('disabled');
                }}
            }});

            // Show/hide sign-in notice
            if (signInNotice) {{
                signInNotice.style.display = enabled ? 'none' : 'flex';
            }}
        }}

        function setInputValue(id, value) {{
            const el = document.getElementById(id);
            if (el && value !== undefined) el.value = value;
        }}

        function setSelectValue(id, value) {{
            const el = document.getElementById(id);
            if (el && value !== undefined) el.value = value;
        }}

        function setToggle(id, active) {{
            const el = document.getElementById(id);
            if (el) {{
                if (active) el.classList.add('active');
                else el.classList.remove('active');
            }}
        }}

        // Handle toggle clicks
        document.querySelectorAll('.toggle').forEach(toggle => {{
            toggle.addEventListener('click', async function() {{
                // Don't allow toggling if disabled
                if (this.classList.contains('disabled')) {{
                    return;
                }}
                this.classList.toggle('active');
                const setting = this.dataset.setting;
                const value = this.classList.contains('active');
                await saveSetting(setting, value);
            }});
        }});

        // Handle input changes
        document.querySelectorAll('input[data-setting]').forEach(input => {{
            input.addEventListener('change', async function() {{
                await saveSetting(this.dataset.setting, this.value);
            }});
        }});

        // Handle select changes
        document.querySelectorAll('select[data-setting]').forEach(select => {{
            select.addEventListener('change', async function() {{
                const setting = this.dataset.setting;
                const value = this.value;

                // Apply theme immediately for visual feedback
                if (setting === 'appearance.theme') {{
                    applyTheme(value);
                }}

                await saveSetting(setting, value);
            }});
        }});

        async function saveSetting(path, value) {{
            try {{
                if (window.jubilee) {{
                    await window.jubilee.invoke('settings:update', {{ path, value }});
                    showSavedIndicator();
                }}
            }} catch (e) {{
                console.error('Failed to save setting:', e);
            }}
        }}

        function showSavedIndicator() {{
            const indicator = document.getElementById('savedIndicator');
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 2000);
        }}

        // Custom Modal Functions
        let modalCallback = null;

        function showConfirmModal(options) {{
            const modal = document.getElementById('confirmModal');
            const icon = document.getElementById('modalIcon');
            const title = document.getElementById('modalTitle');
            const msgPrimary = document.getElementById('modalMessagePrimary');
            const msgSecondary = document.getElementById('modalMessageSecondary');
            const confirmBtn = document.getElementById('modalConfirmBtn');
            const cancelBtn = document.getElementById('modalCancelBtn');

            // Set content
            title.textContent = options.title || 'Confirm';
            msgPrimary.textContent = options.messagePrimary || 'Are you sure?';
            msgSecondary.textContent = options.messageSecondary || '';
            msgSecondary.style.display = options.messageSecondary ? 'block' : 'none';

            // Set icon
            icon.textContent = options.icon || '⚠️';
            icon.className = 'modal-icon' + (options.iconType === 'warning' ? ' warning' : '');

            // Set button text and style
            confirmBtn.textContent = options.confirmText || 'Confirm';
            cancelBtn.textContent = options.cancelText || 'Cancel';

            // Set button style based on type
            confirmBtn.className = 'modal-btn ' + (options.confirmStyle === 'danger' ? 'modal-btn-danger' : 'modal-btn-primary');

            // Store callback
            modalCallback = options.onConfirm;

            // Show modal
            modal.classList.add('show');
        }}

        function hideConfirmModal() {{
            const modal = document.getElementById('confirmModal');
            modal.classList.remove('show');
            modalCallback = null;
        }}

        // Modal event listeners
        document.getElementById('modalClose')?.addEventListener('click', hideConfirmModal);
        document.getElementById('modalCancelBtn')?.addEventListener('click', hideConfirmModal);
        document.getElementById('modalConfirmBtn')?.addEventListener('click', function() {{
            if (modalCallback) {{
                modalCallback();
            }}
            hideConfirmModal();
        }});
        document.getElementById('confirmModal')?.addEventListener('click', function(e) {{
            if (e.target === this) {{
                hideConfirmModal();
            }}
        }});

        // Button handlers
        document.getElementById('manageAccountBtn')?.addEventListener('click', function() {{
            window.jubilee?.send('account:manage');
        }});

        document.getElementById('signInBtn')?.addEventListener('click', function() {{
            window.jubilee?.send('auth:signIn');
        }});

        // Sync page sign-in button
        document.getElementById('syncSignInBtn')?.addEventListener('click', function() {{
            window.jubilee?.send('auth:signIn');
        }});

        // Sync settings search functionality
        document.getElementById('syncSearchInput')?.addEventListener('input', function() {{
            const searchTerm = this.value.toLowerCase().trim();
            const settingRows = document.querySelectorAll('.sync-setting-row');

            settingRows.forEach(row => {{
                const title = row.querySelector('.title')?.textContent?.toLowerCase() || '';
                const description = row.querySelector('.description')?.textContent?.toLowerCase() || '';
                const searchTerms = row.dataset.searchTerms?.toLowerCase() || '';

                const matches = searchTerm === '' ||
                    title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    searchTerms.includes(searchTerm);

                if (matches) {{
                    row.classList.remove('hidden');
                    if (searchTerm !== '') {{
                        row.classList.add('highlight');
                    }} else {{
                        row.classList.remove('highlight');
                    }}
                }} else {{
                    row.classList.add('hidden');
                    row.classList.remove('highlight');
                }}
            }});
        }});

        document.getElementById('signOutBtn')?.addEventListener('click', function() {{
            showConfirmModal({{
                title: 'Sign Out',
                messagePrimary: 'Are you sure you want to sign out?',
                messageSecondary: 'Your local data will be kept, but syncing will stop.',
                icon: '⚠️',
                iconType: 'warning',
                confirmText: 'Sign Out',
                cancelText: 'Cancel',
                confirmStyle: 'danger',
                onConfirm: function() {{
                    window.jubilee?.send('auth:signOut');
                }}
            }});
        }});

        document.getElementById('clearDataBtn')?.addEventListener('click', function() {{
            showConfirmModal({{
                title: 'Clear Browsing Data',
                messagePrimary: 'Clear all browsing data?',
                messageSecondary: 'This will delete your history, cookies, and cached files. This cannot be undone.',
                icon: '🗑️',
                iconType: 'warning',
                confirmText: 'Clear Data',
                cancelText: 'Cancel',
                confirmStyle: 'danger',
                onConfirm: function() {{
                    window.jubilee?.send('privacy:clearData');
                }}
            }});
        }});

        document.getElementById('resetSettingsBtn')?.addEventListener('click', function() {{
            showConfirmModal({{
                title: 'Reset Settings',
                messagePrimary: 'Reset all settings to defaults?',
                messageSecondary: 'All your custom settings will be restored to their original values. This cannot be undone.',
                icon: '🔄',
                iconType: 'warning',
                confirmText: 'Reset Settings',
                cancelText: 'Cancel',
                confirmStyle: 'danger',
                onConfirm: function() {{
                    window.jubilee?.send('settings:reset');
                }}
            }});
        }});

        // Search functionality
        document.getElementById('searchInput')?.addEventListener('input', function(e) {{
            const query = e.target.value.toLowerCase();
            // TODO: Implement search highlighting
        }});
    </script>
</body>
</html>";
    }

    private string GenerateAboutPage(string? query)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0";
        var year = DateTime.Now.Year;

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>About - Jubilee Browser</title>
    <style>
        :root {{
            --color-primary-text: #ffffff;
            --color-secondary-text: #a0a0a0;
            --color-bg-primary: #1a1a2e;
            --color-bg-secondary: #16213e;
            --color-bg-tertiary: #2a2a4e;
            --color-accent-gold: #E6AC00;
            --color-accent-rose: #e94560;
            --color-border: rgba(255, 255, 255, 0.08);
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--color-bg-primary);
            color: var(--color-primary-text);
            min-height: 100vh;
            padding: 40px 20px;
            overflow-y: auto;
        }}

        .container {{
            max-width: 800px;
            margin: 0 auto;
        }}

        /* Header Section */
        .header {{
            text-align: center;
            margin-bottom: 48px;
        }}

        .logo {{
            width: 120px;
            height: 120px;
            background: linear-gradient(135deg, var(--color-accent-rose), var(--color-accent-gold));
            border-radius: 28px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            font-weight: 300;
            box-shadow: 0 8px 32px rgba(233, 69, 96, 0.3);
        }}

        .header h1 {{
            font-size: 36px;
            font-weight: 300;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }}

        .version {{
            display: inline-block;
            background: var(--color-bg-tertiary);
            color: var(--color-accent-gold);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }}

        /* Mission Section */
        .mission {{
            background: var(--color-bg-secondary);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 32px;
            border: 1px solid var(--color-border);
        }}

        .mission h2 {{
            color: var(--color-accent-gold);
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}

        .mission h2::before {{
            content: '';
            width: 4px;
            height: 20px;
            background: var(--color-accent-gold);
            border-radius: 2px;
        }}

        .mission p {{
            color: var(--color-secondary-text);
            line-height: 1.7;
            font-size: 15px;
        }}

        /* Features Grid */
        .features {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 32px;
        }}

        @media (max-width: 600px) {{
            .features {{
                grid-template-columns: 1fr;
            }}
        }}

        .feature-card {{
            background: var(--color-bg-secondary);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--color-border);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }}

        .feature-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }}

        .feature-icon {{
            width: 48px;
            height: 48px;
            background: var(--color-bg-tertiary);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 16px;
        }}

        .feature-card h3 {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }}

        .feature-card p {{
            color: var(--color-secondary-text);
            font-size: 14px;
            line-height: 1.5;
        }}

        /* Dual Mode Section */
        .dual-mode {{
            background: linear-gradient(135deg, rgba(233, 69, 96, 0.1), rgba(230, 172, 0, 0.1));
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 32px;
            border: 1px solid var(--color-border);
        }}

        .dual-mode h2 {{
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            text-align: center;
        }}

        .modes {{
            display: flex;
            gap: 20px;
        }}

        @media (max-width: 600px) {{
            .modes {{
                flex-direction: column;
            }}
        }}

        .mode {{
            flex: 1;
            background: var(--color-bg-secondary);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }}

        .mode-icon {{
            width: 56px;
            height: 56px;
            border-radius: 50%;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
        }}

        .mode.jubilee .mode-icon {{
            background: linear-gradient(135deg, var(--color-accent-rose), var(--color-accent-gold));
        }}

        .mode.standard .mode-icon {{
            background: var(--color-bg-tertiary);
        }}

        .mode h3 {{
            font-size: 16px;
            margin-bottom: 8px;
        }}

        .mode p {{
            color: var(--color-secondary-text);
            font-size: 13px;
            line-height: 1.5;
        }}

        /* Tech Info */
        .tech-info {{
            background: var(--color-bg-secondary);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            border: 1px solid var(--color-border);
        }}

        .tech-info h2 {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--color-secondary-text);
        }}

        .tech-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }}

        @media (max-width: 600px) {{
            .tech-grid {{
                grid-template-columns: 1fr;
            }}
        }}

        .tech-item {{
            text-align: center;
            padding: 16px;
            background: var(--color-bg-primary);
            border-radius: 8px;
        }}

        .tech-item .label {{
            color: var(--color-secondary-text);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}

        .tech-item .value {{
            font-size: 14px;
            font-weight: 500;
        }}

        /* Links */
        .links {{
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 32px;
        }}

        .links a {{
            color: var(--color-accent-gold);
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s ease;
        }}

        .links a:hover {{
            color: var(--color-primary-text);
        }}

        /* Footer */
        .footer {{
            text-align: center;
            color: var(--color-secondary-text);
            font-size: 13px;
            padding-top: 24px;
            border-top: 1px solid var(--color-border);
        }}

        .footer .copyright {{
            margin-bottom: 8px;
        }}

        .footer .tagline {{
            color: var(--color-accent-gold);
            font-style: italic;
        }}
    </style>
</head>
<body>
    <div class='container'>
        <!-- Header -->
        <div class='header'>
            <div class='logo'>J</div>
            <h1>Jubilee Browser</h1>
            <span class='version'>Version {version}</span>
        </div>

        <!-- Mission -->
        <div class='mission'>
            <h2>Our Mission</h2>
            <p>
                Jubilee Browser is a secure, faith-centered web browser designed for the
                <strong>Worldwide Bible Web</strong> community. We believe that browsing the internet
                should be a safe, enriching experience for individuals and families. Built with
                privacy and protection at its core, Jubilee Browser provides seamless access to
                Bible resources, faith-based content, and the broader web with intelligent
                content filtering to ensure a wholesome browsing experience.
            </p>
        </div>

        <!-- Dual Mode -->
        <div class='dual-mode'>
            <h2>Dual Browsing Modes</h2>
            <div class='modes'>
                <div class='mode jubilee'>
                    <div class='mode-icon'>J</div>
                    <h3>Jubilee Mode</h3>
                    <p>
                        Access the Worldwide Bible Web with curated faith-based content,
                        Bible study tools, and community resources. Enhanced filtering
                        ensures a safe, spiritually enriching experience.
                    </p>
                </div>
                <div class='mode standard'>
                    <div class='mode-icon'>W</div>
                    <h3>Web Mode</h3>
                    <p>
                        Browse the full internet with intelligent content filtering
                        that protects your family while giving you access to the
                        information you need.
                    </p>
                </div>
            </div>
        </div>

        <!-- Features -->
        <div class='features'>
            <div class='feature-card'>
                <div class='feature-icon'>&#128274;</div>
                <h3>Privacy Protection</h3>
                <p>Advanced tracking prevention, Do Not Track support, and the ability to clear browsing data automatically.</p>
            </div>
            <div class='feature-card'>
                <div class='feature-icon'>&#128106;</div>
                <h3>Family-Friendly</h3>
                <p>Built-in content filtering keeps inappropriate content away, making it safe for the whole family.</p>
            </div>
            <div class='feature-card'>
                <div class='feature-icon'>&#128218;</div>
                <h3>Bible Integration</h3>
                <p>Quick access to Jubilee Bibles resources, Scripture references, and faith-based study tools.</p>
            </div>
            <div class='feature-card'>
                <div class='feature-icon'>&#9729;</div>
                <h3>Cloud Sync</h3>
                <p>Sync your bookmarks, history, and settings across all your devices with a Jubilee account.</p>
            </div>
            <div class='feature-card'>
                <div class='feature-icon'>&#127912;</div>
                <h3>Customizable Themes</h3>
                <p>Choose between dark, light, or system-matched themes for comfortable browsing any time of day.</p>
            </div>
            <div class='feature-card'>
                <div class='feature-icon'>&#128187;</div>
                <h3>Modern Performance</h3>
                <p>Built on Microsoft Edge WebView2 for fast, secure, and standards-compliant web browsing.</p>
            </div>
        </div>

        <!-- Tech Info -->
        <div class='tech-info'>
            <h2>Technical Information</h2>
            <div class='tech-grid'>
                <div class='tech-item'>
                    <div class='label'>Engine</div>
                    <div class='value'>WebView2 (Chromium)</div>
                </div>
                <div class='tech-item'>
                    <div class='label'>Framework</div>
                    <div class='value'>WPF (.NET 8)</div>
                </div>
                <div class='tech-item'>
                    <div class='label'>Platform</div>
                    <div class='value'>Windows 10/11</div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class='footer'>
            <p class='copyright'>&copy; {year} Jubilee Browser. All rights reserved.</p>
            <p class='tagline'>""Browsing with Purpose, Protected by Faith""</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GenerateBlockedPage(string? query)
    {
        var url = "";
        var reason = "Content blocked by filter";

        if (!string.IsNullOrEmpty(query))
        {
            var parsed = System.Web.HttpUtility.ParseQueryString(query);
            url = parsed["url"] ?? "";
            reason = parsed["reason"] ?? reason;
        }

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Blocked - Jubilee Browser</title>
    <style>
        body {{
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }}
        .blocked-card {{
            text-align: center;
            padding: 40px;
        }}
        .icon {{
            font-size: 80px;
            margin-bottom: 20px;
        }}
        h1 {{
            color: #e94560;
            margin-bottom: 10px;
        }}
        p {{
            color: #a0a0a0;
            margin-bottom: 20px;
        }}
        .url {{
            background: #16213e;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            max-width: 500px;
        }}
        .back-btn {{
            display: inline-block;
            margin-top: 30px;
            padding: 12px 24px;
            background: #e94560;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            cursor: pointer;
        }}
        .back-btn:hover {{
            background: #d13a55;
        }}
    </style>
</head>
<body>
    <div class='blocked-card'>
        <div class='icon'>🚫</div>
        <h1>Content Blocked</h1>
        <p>{System.Web.HttpUtility.HtmlEncode(reason)}</p>
        <div class='url'>{System.Web.HttpUtility.HtmlEncode(url)}</div>
        <a class='back-btn' onclick='history.back()'>Go Back</a>
    </div>
</body>
</html>";
    }

    private string GenerateErrorPage(string? query)
    {
        var errorMessage = query ?? "An error occurred";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Error - Jubilee Browser</title>
    <style>
        body {{
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }}
        .error-card {{
            text-align: center;
            padding: 40px;
        }}
        .icon {{
            font-size: 80px;
            margin-bottom: 20px;
        }}
        h1 {{
            color: #e94560;
            margin-bottom: 10px;
        }}
        p {{
            color: #a0a0a0;
        }}
    </style>
</head>
<body>
    <div class='error-card'>
        <div class='icon'>⚠️</div>
        <h1>Error</h1>
        <p>{System.Web.HttpUtility.HtmlEncode(errorMessage)}</p>
    </div>
</body>
</html>";
    }

    private string GenerateWelcomePage(string? query)
    {
        return @"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Welcome - Jubilee Browser</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .welcome {
            text-align: center;
        }
        h1 {
            font-size: 48px;
            font-weight: 300;
            margin-bottom: 20px;
        }
        p {
            color: #a0a0a0;
            font-size: 18px;
        }
        .logo {
            width: 120px;
            height: 120px;
            background: linear-gradient(135deg, #e94560, #E6AC00);
            border-radius: 24px;
            margin: 0 auto 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
        }
    </style>
</head>
<body>
    <div class='welcome'>
        <div class='logo'>J</div>
        <h1>Welcome to Jubilee Browser</h1>
        <p>A secure, family-friendly browsing experience</p>
    </div>
</body>
</html>";
    }

    private string Generate404Page(string pageName)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Not Found - Jubilee Browser</title>
    <style>
        body {{
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }}
        .error-card {{
            text-align: center;
            padding: 40px;
        }}
        .code {{
            font-size: 120px;
            font-weight: 300;
            color: #e94560;
        }}
        h1 {{
            margin-bottom: 10px;
        }}
        p {{
            color: #a0a0a0;
        }}
    </style>
</head>
<body>
    <div class='error-card'>
        <div class='code'>404</div>
        <h1>Page Not Found</h1>
        <p>The page 'jubilee://{System.Web.HttpUtility.HtmlEncode(pageName)}' does not exist.</p>
    </div>
</body>
</html>";
    }

    private string GenerateHistoryPage(string? query)
    {
        return @"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>History - Jubilee Browser</title>
    <style>
        /* ===== CSS Custom Properties (Design Tokens) ===== */
        :root {
            --color-primary-text: #ffffff;
            --color-accent-gold: #E6AC00;
            --color-accent-red: #e94560;
            --color-bg-primary: #1a1a2e;
            --color-bg-secondary: #16213e;
            --color-bg-tertiary: #2a2a4e;
            --color-bg-hover: #3a3a5e;
            --color-border: rgba(255, 255, 255, 0.08);
            --color-success: #4CAF50;
            --color-error: #f44336;
            --scrollbar-track: var(--color-bg-secondary);
            --scrollbar-thumb: var(--color-bg-tertiary);
            --scrollbar-thumb-hover: var(--color-accent-gold);
            --font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 5px; border: 2px solid var(--scrollbar-track); }
        ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
        * { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track); }

        /* Base Reset */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--font-family);
            background: var(--color-bg-primary);
            color: var(--color-primary-text);
            min-height: 100vh;
            line-height: 1.5;
        }

        /* Layout */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 60px;
        }

        /* Header */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .header-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--color-accent-red), var(--color-accent-gold));
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 400;
        }
        .header .subtitle {
            color: var(--color-primary-text);
            opacity: 0.7;
            font-size: 14px;
        }

        /* Search Box */
        .search-box {
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            transition: border-color 0.2s ease;
        }
        .search-box:focus-within { border-color: var(--color-accent-gold); }
        .search-box input {
            background: transparent;
            border: none;
            color: var(--color-primary-text);
            font-size: 14px;
            flex: 1;
            outline: none;
        }
        .search-box input::placeholder { color: var(--color-primary-text); opacity: 0.5; }
        .search-icon { color: var(--color-accent-gold); margin-right: 12px; font-size: 18px; }

        /* Bulk Actions Bar */
        .bulk-actions {
            background: var(--color-bg-secondary);
            border-radius: 10px;
            padding: 12px 20px;
            margin-bottom: 24px;
            display: none;
            align-items: center;
            justify-content: space-between;
            border: 1px solid var(--color-accent-gold);
        }
        .bulk-actions.visible { display: flex; }
        .bulk-actions .selected-count {
            color: var(--color-accent-gold);
            font-weight: 500;
        }
        .bulk-actions .actions {
            display: flex;
            gap: 12px;
        }

        /* Buttons */
        .btn {
            background: var(--color-accent-gold);
            color: var(--color-bg-primary);
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s ease, transform 0.1s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn:hover { background: #d49c00; }
        .btn:active { transform: scale(0.98); }
        .btn-danger { background: var(--color-accent-red); color: white; }
        .btn-danger:hover { background: #d13a55; }
        .btn-secondary { background: var(--color-bg-tertiary); color: var(--color-primary-text); }
        .btn-secondary:hover { background: var(--color-bg-hover); }

        /* Date Group */
        .date-group {
            margin-bottom: 32px;
        }
        .date-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--color-border);
        }
        .date-header h2 {
            font-size: 16px;
            font-weight: 600;
            color: var(--color-accent-gold);
        }
        .date-header .count {
            background: var(--color-bg-tertiary);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            color: var(--color-primary-text);
            opacity: 0.8;
        }

        /* History Item */
        .history-item {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            background: var(--color-bg-secondary);
            border-radius: 10px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
            border: 2px solid transparent;
        }
        .history-item:hover { background: var(--color-bg-tertiary); }
        .history-item.selected {
            border-color: var(--color-accent-gold);
            background: rgba(230, 172, 0, 0.1);
        }

        /* Checkbox */
        .checkbox-wrapper {
            margin-right: 14px;
            display: flex;
            align-items: center;
        }
        .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid var(--color-bg-hover);
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }
        .checkbox:hover { border-color: var(--color-accent-gold); }
        .checkbox.checked {
            background: var(--color-accent-gold);
            border-color: var(--color-accent-gold);
        }
        .checkbox.checked::after {
            content: '✓';
            color: var(--color-bg-primary);
            font-size: 14px;
            font-weight: bold;
        }

        /* Favicon */
        .favicon {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: var(--color-bg-tertiary);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 14px;
            font-size: 16px;
            flex-shrink: 0;
            overflow: hidden;
        }
        .favicon img {
            width: 20px;
            height: 20px;
            object-fit: contain;
        }

        /* Item Content */
        .item-content {
            flex: 1;
            min-width: 0;
            margin-right: 16px;
        }
        .item-title {
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }
        .item-url {
            font-size: 12px;
            color: var(--color-primary-text);
            opacity: 0.6;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Item Time */
        .item-time {
            font-size: 12px;
            color: var(--color-primary-text);
            opacity: 0.5;
            white-space: nowrap;
            margin-right: 12px;
        }

        /* Delete Button (per item) */
        .item-delete {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: transparent;
            border: none;
            color: var(--color-primary-text);
            opacity: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            font-size: 16px;
        }
        .history-item:hover .item-delete { opacity: 0.5; }
        .item-delete:hover { opacity: 1 !important; color: var(--color-accent-red); background: rgba(233, 69, 96, 0.1); }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 80px 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .empty-state .icon { font-size: 64px; margin-bottom: 24px; opacity: 0.3; }
        .empty-state h2 { font-size: 24px; font-weight: 400; margin-bottom: 12px; }
        .empty-state p { color: var(--color-primary-text); opacity: 0.6; margin-bottom: 24px; }

        /* Retry Button - Premium Styling */
        .retry-btn {
            background: linear-gradient(135deg, var(--color-accent-gold), #d49c00);
            color: var(--color-bg-primary);
            border: none;
            padding: 14px 32px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            min-width: 140px;
            box-shadow: 0 4px 12px rgba(230, 172, 0, 0.3);
        }
        .retry-btn:hover {
            background: linear-gradient(135deg, #f0b800, var(--color-accent-gold));
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(230, 172, 0, 0.4);
        }
        .retry-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(230, 172, 0, 0.3);
        }
        .retry-btn:disabled {
            background: var(--color-bg-tertiary);
            color: var(--color-primary-text);
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .retry-icon { font-size: 16px; }

        /* Button Spinner */
        .btn-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            display: inline-block;
        }

        /* Loading */
        .loading {
            text-align: center;
            padding: 60px;
            color: var(--color-primary-text);
            opacity: 0.7;
        }
        .loading .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-bg-tertiary);
            border-top-color: var(--color-accent-gold);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Toast Notification */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-accent-gold);
            padding: 16px 24px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .toast.show { opacity: 1; transform: translateY(0); }
        .toast .icon { font-size: 20px; }
        .toast.success { border-color: var(--color-success); }
        .toast.success .icon { color: var(--color-success); }

        /* Responsive */
        @media (max-width: 768px) {
            .container { padding: 24px; }
            .header { flex-direction: column; align-items: flex-start; gap: 16px; }
            .item-time { display: none; }
        }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <div class='header-left'>
                <div class='header-icon'>🕐</div>
                <div>
                    <h1>History</h1>
                    <p class='subtitle'>Your browsing activity</p>
                </div>
            </div>
            <button class='btn btn-secondary' id='clearAllBtn' style='display: none;'>
                <span>🗑️</span> Clear All History
            </button>
        </div>

        <div class='search-box'>
            <span class='search-icon'>🔍</span>
            <input type='text' placeholder='Search history...' id='searchInput'>
        </div>

        <div class='bulk-actions' id='bulkActions'>
            <span class='selected-count'><span id='selectedCount'>0</span> items selected</span>
            <div class='actions'>
                <button class='btn btn-secondary' id='selectAllBtn'>Select All</button>
                <button class='btn btn-danger' id='deleteSelectedBtn'>
                    <span>🗑️</span> Delete Selected
                </button>
            </div>
        </div>

        <div id='historyContainer'>
            <div class='loading'>
                <div class='spinner'></div>
                <p>Loading history...</p>
            </div>
        </div>
    </div>

    <div class='toast' id='toast'>
        <span class='icon'>✓</span>
        <span class='message' id='toastMessage'>Items deleted</span>
    </div>

    <script>
        // Jubilee Bridge - embedded directly for NavigateToString pages
        (function() {
            if (window.jubilee) return;

            const pendingRequests = new Map();

            // Check if WebView2 bridge is available
            console.log('chrome.webview available:', !!window.chrome?.webview);
            console.log('postMessage available:', !!window.chrome?.webview?.postMessage);

            window.jubilee = {
                invoke: function(channel, args) {
                    return new Promise((resolve, reject) => {
                        const id = Math.random().toString(36).substr(2, 9);
                        pendingRequests.set(id, { resolve, reject });

                        console.log('Sending message:', { channel, args, id });

                        if (!window.chrome?.webview?.postMessage) {
                            console.error('postMessage not available!');
                            reject(new Error('WebView bridge not available'));
                            return;
                        }

                        // Pass object directly - WebMessageAsJson will serialize it
                        window.chrome.webview.postMessage({
                            channel: channel,
                            args: args || {},
                            id: id
                        });

                        console.log('Message sent successfully');

                        setTimeout(() => {
                            if (pendingRequests.has(id)) {
                                console.log('Request timed out for id:', id);
                                pendingRequests.delete(id);
                                reject(new Error('Request timeout'));
                            }
                        }, 30000);
                    });
                },

                send: function(channel, args) {
                    // Pass object directly - WebMessageAsJson will serialize it
                    window.chrome.webview.postMessage({
                        channel: channel,
                        args: args || {}
                    });
                },

                on: function(channel, callback) {
                    window.addEventListener('jubilee-message', function(e) {
                        if (e.detail && e.detail.channel === channel) {
                            callback(e.detail.data);
                        }
                    });
                }
            };

            window.addEventListener('jubilee-response', function(e) {
                const response = e.detail;
                if (response.id && pendingRequests.has(response.id)) {
                    const { resolve, reject } = pendingRequests.get(response.id);
                    pendingRequests.delete(response.id);

                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.result);
                    }
                }
            });

            console.log('Jubilee Bridge initialized (inline)');
        })();

        let historyData = [];
        let selectedIds = new Set();
        let searchQuery = '';

        document.addEventListener('DOMContentLoaded', async function() {
            try {
                await loadHistory();
            } catch (e) {
                console.error('Failed to load history:', e);
                showError();
            }
            setupEventListeners();
        });

        function setupEventListeners() {
            document.getElementById('searchInput').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                renderHistory();
            });

            document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);
            document.getElementById('selectAllBtn').addEventListener('click', toggleSelectAll);
            document.getElementById('clearAllBtn').addEventListener('click', clearAllHistory);
        }

        async function loadHistory() {
            try {
                if (window.jubilee) {
                    historyData = await window.jubilee.invoke('history:getAll');
                } else {
                    throw new Error('Jubilee bridge not available');
                }
                renderHistory();
            } catch (e) {
                console.error('Failed to load history:', e);
                showError();
            }
        }

        function showError() {
            document.getElementById('historyContainer').innerHTML = `
                <div class='empty-state'>
                    <div class='icon'>⚠️</div>
                    <h2>Failed to load history</h2>
                    <p>Please try again later</p>
                    <button class='btn retry-btn' id='retryBtn' onclick='retryLoad()'>
                        <span class='retry-icon'>🔄</span>
                        <span class='retry-text'>Retry</span>
                    </button>
                </div>
            `;
        }

        async function retryLoad() {
            const retryBtn = document.getElementById('retryBtn');
            if (retryBtn) {
                retryBtn.disabled = true;
                retryBtn.innerHTML = `
                    <span class='btn-spinner'></span>
                    <span>Loading...</span>
                `;
            }
            await loadHistory();
        }

        function renderHistory() {
            const container = document.getElementById('historyContainer');
            const clearAllBtn = document.getElementById('clearAllBtn');

            // Filter by search (using camelCase properties from C# serialization)
            let filtered = historyData;
            if (searchQuery) {
                filtered = historyData.filter(item =>
                    (item.title || '').toLowerCase().includes(searchQuery) ||
                    (item.url || '').toLowerCase().includes(searchQuery)
                );
            }

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class='empty-state'>
                        <div class='icon'>🕐</div>
                        <h2>${searchQuery ? 'No results found' : 'No history yet'}</h2>
                        <p>${searchQuery ? 'Try a different search term' : 'Your browsing history will appear here'}</p>
                    </div>
                `;
                clearAllBtn.style.display = 'none';
                return;
            }

            clearAllBtn.style.display = 'flex';

            // Group by date
            const groups = groupByDate(filtered);
            let html = '';

            for (const [date, items] of Object.entries(groups)) {
                html += `
                    <div class='date-group'>
                        <div class='date-header'>
                            <h2>${date}</h2>
                            <span class='count'>${items.length} ${items.length === 1 ? 'page' : 'pages'}</span>
                        </div>
                `;

                for (const item of items) {
                    const isSelected = selectedIds.has(item.id);
                    const time = formatTime(item.timestamp);
                    const faviconHtml = item.favicon
                        ? `<img src='${escapeHtml(item.favicon)}' onerror=""this.parentElement.innerHTML='🌐'"" />`
                        : '🌐';

                    html += `
                        <div class='history-item ${isSelected ? 'selected' : ''}' data-id='${item.id}'>
                            <div class='checkbox-wrapper'>
                                <div class='checkbox ${isSelected ? 'checked' : ''}' data-id='${item.id}'></div>
                            </div>
                            <div class='favicon'>${faviconHtml}</div>
                            <div class='item-content' data-url='${escapeHtml(item.url)}'>
                                <div class='item-title'>${escapeHtml(item.title || item.url)}</div>
                                <div class='item-url'>${escapeHtml(item.url)}</div>
                            </div>
                            <div class='item-time'>${time}</div>
                            <button class='item-delete' data-id='${item.id}' title='Delete'>🗑️</button>
                        </div>
                    `;
                }

                html += '</div>';
            }

            container.innerHTML = html;

            // Attach event listeners
            container.querySelectorAll('.checkbox').forEach(cb => {
                cb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleSelect(cb.dataset.id);
                });
            });

            container.querySelectorAll('.item-content').forEach(content => {
                content.addEventListener('click', () => {
                    const url = content.dataset.url;
                    if (url && window.jubilee) {
                        window.jubilee.send('nav:go', { url });
                    }
                });
            });

            container.querySelectorAll('.item-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteItem(btn.dataset.id);
                });
            });

            updateBulkActions();
        }

        function groupByDate(items) {
            const groups = {};
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            for (const item of items) {
                const date = new Date(item.timestamp);
                let label;

                if (isSameDay(date, today)) {
                    label = 'Today';
                } else if (isSameDay(date, yesterday)) {
                    label = 'Yesterday';
                } else if (isThisWeek(date)) {
                    label = date.toLocaleDateString('en-US', { weekday: 'long' });
                } else {
                    label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                }

                if (!groups[label]) groups[label] = [];
                groups[label].push(item);
            }

            return groups;
        }

        function isSameDay(d1, d2) {
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
        }

        function isThisWeek(date) {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date > weekAgo;
        }

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/""/g, '&quot;');
        }

        function toggleSelect(id) {
            if (selectedIds.has(id)) {
                selectedIds.delete(id);
            } else {
                selectedIds.add(id);
            }
            renderHistory();
        }

        function toggleSelectAll() {
            const allIds = historyData.map(item => item.id);
            if (selectedIds.size === allIds.length) {
                selectedIds.clear();
            } else {
                allIds.forEach(id => selectedIds.add(id));
            }
            renderHistory();
        }

        function updateBulkActions() {
            const bulkActions = document.getElementById('bulkActions');
            const selectedCount = document.getElementById('selectedCount');
            const selectAllBtn = document.getElementById('selectAllBtn');

            if (selectedIds.size > 0) {
                bulkActions.classList.add('visible');
                selectedCount.textContent = selectedIds.size;
                selectAllBtn.textContent = selectedIds.size === historyData.length ? 'Deselect All' : 'Select All';
            } else {
                bulkActions.classList.remove('visible');
            }
        }

        async function deleteItem(id) {
            try {
                if (window.jubilee) {
                    await window.jubilee.invoke('history:delete', { ids: [id] });
                }
                historyData = historyData.filter(item => item.id !== id);
                selectedIds.delete(id);
                renderHistory();
                showToast('Item deleted');
            } catch (e) {
                console.error('Failed to delete item:', e);
            }
        }

        async function deleteSelected() {
            if (selectedIds.size === 0) return;

            try {
                const ids = Array.from(selectedIds);
                if (window.jubilee) {
                    await window.jubilee.invoke('history:delete', { ids });
                }
                historyData = historyData.filter(item => !selectedIds.has(item.id));
                const count = selectedIds.size;
                selectedIds.clear();
                renderHistory();
                showToast(`${count} ${count === 1 ? 'item' : 'items'} deleted`);
            } catch (e) {
                console.error('Failed to delete items:', e);
            }
        }

        async function clearAllHistory() {
            if (!confirm('Are you sure you want to clear all browsing history? This cannot be undone.')) {
                return;
            }

            try {
                if (window.jubilee) {
                    await window.jubilee.invoke('history:clearAll');
                }
                historyData = [];
                selectedIds.clear();
                renderHistory();
                showToast('All history cleared');
            } catch (e) {
                console.error('Failed to clear history:', e);
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toastMessage');
            toastMessage.textContent = message;
            toast.classList.add('show', 'success');

            setTimeout(() => {
                toast.classList.remove('show', 'success');
            }, 3000);
        }
    </script>
</body>
</html>";
    }

    private string GenerateNewTabPage(string? query)
    {
        return @"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>New Tab - Jubilee Browser</title>
    <style>
        :root {
            --color-primary-text: #ffffff;
            --color-bg-primary: #1a1a2e;
            --color-bg-secondary: #16213e;
            --color-bg-tertiary: #2a2a4e;
            --color-bg-hover: #3a3a5e;
            --color-accent-gold: #E6AC00;
            --color-border: rgba(255, 255, 255, 0.08);
            --color-text-muted: #8a8a9a;
        }
        :root[data-theme='light'] {
            --color-primary-text: #1a1a1a;
            --color-bg-primary: #ffffff;
            --color-bg-secondary: #f5f5f5;
            --color-bg-tertiary: #e8e8e8;
            --color-bg-hover: #e0e0e0;
            --color-accent-gold: #B8860B;
            --color-border: rgba(0, 0, 0, 0.1);
            --color-text-muted: #666666;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--color-bg-primary);
            color: var(--color-primary-text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }
        .logo-container {
            margin-bottom: 40px;
            text-align: center;
        }
        .logo {
            width: 80px;
            height: 80px;
            margin-bottom: 16px;
        }
        .brand-text {
            font-size: 28px;
            font-weight: 600;
            color: var(--color-accent-gold);
        }
        .search-container {
            width: 100%;
            max-width: 600px;
            margin-bottom: 60px;
        }
        .search-box {
            display: flex;
            align-items: center;
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: 24px;
            padding: 12px 20px;
            transition: all 0.2s ease;
        }
        .search-box:focus-within {
            border-color: var(--color-accent-gold);
            box-shadow: 0 0 0 3px rgba(230, 172, 0, 0.15);
        }
        .search-icon {
            font-size: 18px;
            color: var(--color-text-muted);
            margin-right: 12px;
        }
        .search-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-size: 16px;
            color: var(--color-primary-text);
        }
        .search-input::placeholder {
            color: var(--color-text-muted);
        }
        .shortcuts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 120px));
            gap: 20px;
            justify-content: center;
            max-width: 800px;
        }
        .shortcut {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            color: var(--color-primary-text);
        }
        .shortcut:hover {
            background: var(--color-bg-hover);
        }
        .shortcut-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: var(--color-bg-tertiary);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            font-size: 24px;
        }
        .shortcut-label {
            font-size: 12px;
            color: var(--color-text-muted);
            text-align: center;
        }
        .greeting {
            font-size: 18px;
            color: var(--color-text-muted);
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class='logo-container'>
        <div class='brand-text'>Jubilee Browser</div>
    </div>

    <p class='greeting' id='greeting'></p>

    <div class='search-container'>
        <div class='search-box'>
            <span class='search-icon'>🔍</span>
            <input type='text' class='search-input' id='searchInput' placeholder='Search the web or enter URL' autofocus>
        </div>
    </div>

    <div class='shortcuts'>
        <a class='shortcut' href='https://www.google.com'>
            <div class='shortcut-icon'>🔍</div>
            <span class='shortcut-label'>Google</span>
        </a>
        <a class='shortcut' href='https://www.youtube.com'>
            <div class='shortcut-icon'>▶️</div>
            <span class='shortcut-label'>YouTube</span>
        </a>
        <a class='shortcut' href='https://www.wikipedia.org'>
            <div class='shortcut-icon'>📚</div>
            <span class='shortcut-label'>Wikipedia</span>
        </a>
        <a class='shortcut' href='https://www.github.com'>
            <div class='shortcut-icon'>💻</div>
            <span class='shortcut-label'>GitHub</span>
        </a>
        <a class='shortcut' href='jubilee://settings'>
            <div class='shortcut-icon'>⚙️</div>
            <span class='shortcut-label'>Settings</span>
        </a>
        <a class='shortcut' href='jubilee://history'>
            <div class='shortcut-icon'>📜</div>
            <span class='shortcut-label'>History</span>
        </a>
    </div>

    <script>
        // Set greeting based on time of day
        function setGreeting() {
            const hour = new Date().getHours();
            let greeting = 'Good evening';
            if (hour >= 5 && hour < 12) greeting = 'Good morning';
            else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
            document.getElementById('greeting').textContent = greeting;
        }
        setGreeting();

        // Handle search
        document.getElementById('searchInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (query) {
                    // Check if it looks like a URL
                    if (query.includes('.') && !query.includes(' ')) {
                        window.location.href = query.startsWith('http') ? query : 'https://' + query;
                    } else {
                        // Search with Google (or configured search engine)
                        window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
                    }
                }
            }
        });
    </script>
</body>
</html>";
    }
}
