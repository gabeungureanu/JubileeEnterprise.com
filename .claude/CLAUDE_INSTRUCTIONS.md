# ClaudeBrowser - Claude Code Integration Instructions

## Overview

ClaudeBrowser is a diagnostic browser tool located in the workspace at `c:\data\ClaudeBrowser`. It enables Claude Code to launch a Chromium-based browser, navigate to web pages, capture screenshots, and analyze visual output using AI computer vision capabilities. The browser supports both desktop mode (800x600 default) and iPhone 12 Pro Max mobile emulation (428x926 portrait).

## Launching the Browser

To launch ClaudeBrowser and capture a screenshot for visual analysis, run the following command from the workspace root using the Bash tool. The `--screenshot` flag captures the page after load, and the screenshot will be saved to the `claudebrowser-output` directory. After capturing, use the Read tool to view the screenshot image file, which will render visually for AI analysis.

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --headed --screenshot --screenshot-path ./claudebrowser-output/screenshot.png
```

For headless operation (no visible browser window), omit the `--headed` flag:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --screenshot --screenshot-path ./claudebrowser-output/screenshot.png
```

## Viewing Screenshots with Computer Vision

After capturing a screenshot, read the image file using the Read tool to visually analyze the page content. The Read tool supports image files and will display them for AI visual inspection:

```
Read tool: c:\data\ClaudeBrowser\claudebrowser-output\screenshot.png
```

## Mobile Device Testing

To test pages in iPhone 12 Pro Max emulation mode (428x926 portrait, 19.5:9 aspect ratio), add the `--mobile` flag:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --headed --mobile --screenshot --screenshot-path ./claudebrowser-output/mobile-screenshot.png
```

## Interactive Mode for Manual Inspection

For interactive sessions where the browser remains open for manual testing and navigation, use the `--interactive` flag. This mode includes a floating toolbar to toggle between desktop and mobile views. The browser will remember its last state (mobile/desktop mode and window position) across sessions:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --headed --interactive
```

## Full Diagnostics with Network and Console Logging

To capture comprehensive diagnostics including network requests, console messages, and HAR files for debugging, use multiple flags together:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --headed --screenshot --har --network-log --verbose --output-dir ./claudebrowser-output
```

## JSON Output for Programmatic Analysis

For structured diagnostic data that can be parsed programmatically, use the `--json` flag to output results in JSON format:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect <URL> --json --screenshot --json-file ./claudebrowser-output/report.json
```

## Common Testing Workflow

When testing a web application or page, follow this workflow: First, launch the browser with screenshot capture enabled targeting the URL to test. Second, use the Read tool to view the captured screenshot for visual analysis. Third, analyze the visual output for layout issues, content verification, or UI problems. Fourth, if issues are found, make code changes and repeat the process to verify fixes.

## Available Command Options

The inspect command accepts the following options: `--headed` shows the browser window, `--headless` runs without UI (default), `--screenshot` captures a screenshot after page load, `--screenshot-path <path>` specifies the screenshot file location, `--mobile` enables iPhone 12 Pro Max emulation, `--interactive` keeps the browser open for manual inspection, `--har` generates a HAR file for network analysis, `--network-log` shows network request details, `--console-errors` displays console errors (enabled by default), `--verbose` enables detailed output, `--json` outputs results as JSON, `--timeout <ms>` sets navigation timeout in milliseconds, `--viewport <WxH>` sets custom viewport size, and `--output-dir <dir>` specifies the output directory for all generated files.

## Example Test Scenarios

To verify a homepage loads correctly, capture a screenshot and visually confirm the expected elements are present:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect https://example.com --screenshot --screenshot-path ./claudebrowser-output/homepage.png
```

To test responsive design, capture both desktop and mobile screenshots and compare the layouts:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect https://example.com --screenshot --screenshot-path ./claudebrowser-output/desktop.png
cd /c/data/ClaudeBrowser && node dist/index.js inspect https://example.com --mobile --screenshot --screenshot-path ./claudebrowser-output/mobile.png
```

To debug a page with errors, capture full diagnostics including console output and network logs:

```bash
cd /c/data/ClaudeBrowser && node dist/index.js inspect https://example.com --screenshot --har --verbose --json-file ./claudebrowser-output/debug-report.json
```
