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
        :root {{
            /* Primary Colors */
            --color-primary-text: #ffffff;
            --color-accent-gold: #E6AC00;
            --color-accent-red: #e94560;

            /* Background Colors */
            --color-bg-primary: #1a1a2e;
            --color-bg-secondary: #16213e;
            --color-bg-tertiary: #2a2a4e;
            --color-bg-hover: #3a3a5e;

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

                <div class='setting-group'>
                    <h3>Profile Actions</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sign out</div>
                            <div class='description'>Sign out of your Jubilee account on this device</div>
                        </div>
                        <button class='btn btn-secondary' id='signOutBtn'>Sign Out</button>
                    </div>
                </div>
            </div>

            <!-- Sync Section -->
            <div class='section {(section == "sync" ? "active" : "")}' id='section-sync'>
                <h1>Sync</h1>
                <p class='subtitle'>Sync your data across devices</p>

                <div class='setting-group'>
                    <h3>Sync Settings</h3>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sync bookmarks</div>
                            <div class='description'>Keep your bookmarks in sync across all your devices</div>
                        </div>
                        <div class='toggle' data-setting='sync.bookmarks' id='syncBookmarks'></div>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sync history</div>
                            <div class='description'>Sync your browsing history</div>
                        </div>
                        <div class='toggle' data-setting='sync.history' id='syncHistory'></div>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sync passwords</div>
                            <div class='description'>Sync saved passwords (encrypted)</div>
                        </div>
                        <div class='toggle' data-setting='sync.passwords' id='syncPasswords'></div>
                    </div>
                    <div class='setting-row'>
                        <div class='setting-label'>
                            <div class='title'>Sync settings</div>
                            <div class='description'>Sync your browser settings</div>
                        </div>
                        <div class='toggle' data-setting='sync.settings' id='syncSettings'></div>
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
                        <input type='text' data-setting='homepage.jubileeBibles' id='homepageJubileeBibles' placeholder='inspire://jubileeverse.webspace'>
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
                            <option value='duckduckgo'>DuckDuckGo</option>
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

        function applySettingsToUI(s) {{
            if (!s) return;

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

            if (info && info.isSignedIn) {{
                avatar.textContent = (info.displayName || info.email || '?')[0].toUpperCase();
                name.textContent = info.displayName || 'Jubilee User';
                email.textContent = info.email || '';

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
            }} else {{
                avatar.textContent = '?';
                name.textContent = 'Not signed in';
                email.textContent = 'Sign in to sync your data';
                syncContainer.className = 'sync-status';
                syncStatus.textContent = 'Sign in to enable sync';
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
                await saveSetting(this.dataset.setting, this.value);
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

        // Button handlers
        document.getElementById('manageAccountBtn')?.addEventListener('click', function() {{
            window.jubilee?.send('account:manage');
        }});

        document.getElementById('signOutBtn')?.addEventListener('click', function() {{
            if (confirm('Are you sure you want to sign out?')) {{
                window.jubilee?.send('auth:signOut');
            }}
        }});

        document.getElementById('clearDataBtn')?.addEventListener('click', function() {{
            window.jubilee?.send('privacy:clearData');
        }});

        document.getElementById('resetSettingsBtn')?.addEventListener('click', function() {{
            if (confirm('Reset all settings to defaults? This cannot be undone.')) {{
                window.jubilee?.send('settings:reset');
            }}
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

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>About - Jubilee Browser</title>
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
        .about-card {{
            background: #16213e;
            border-radius: 16px;
            padding: 60px;
            text-align: center;
            max-width: 500px;
        }}
        .logo {{
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #e94560, #E6AC00);
            border-radius: 20px;
            margin: 0 auto 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
        }}
        h1 {{
            margin-bottom: 10px;
            font-weight: 300;
        }}
        .version {{
            color: #e94560;
            font-size: 18px;
            margin-bottom: 20px;
        }}
        .description {{
            color: #a0a0a0;
            line-height: 1.6;
            margin-bottom: 30px;
        }}
        .tech {{
            background: #1a1a2e;
            padding: 15px;
            border-radius: 8px;
            font-size: 14px;
            color: #a0a0a0;
        }}
        .tech strong {{
            color: #ffffff;
        }}
    </style>
</head>
<body>
    <div class='about-card'>
        <div class='logo'>J</div>
        <h1>Jubilee Browser</h1>
        <div class='version'>Version {version}</div>
        <p class='description'>
            A secure, family-friendly web browser with dual browsing modes.
            Browse the web safely with built-in content filtering and
            seamless access to Jubilee Bibles resources.
        </p>
        <div class='tech'>
            <strong>Powered by</strong> WebView2 (Microsoft Edge)<br>
            <strong>Built with</strong> WPF (.NET 8)
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
}
