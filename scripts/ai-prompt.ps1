<#
.SYNOPSIS
    AI Prompt Bootstrap Wrapper

.DESCRIPTION
    Prepends namespace governance files to any AI prompt, ensuring
    the AI always has the required context regardless of session history.

.PARAMETER Prompt
    The user's prompt to send to the AI

.PARAMETER Output
    Output mode: "clipboard" (default), "file", or "stdout"

.PARAMETER OutputFile
    Path to output file (when -Output file)

.EXAMPLE
    .\scripts\ai-prompt.ps1 -Prompt "How do I add a new website service?"

.EXAMPLE
    .\scripts\ai-prompt.ps1 -Prompt "Fix the health check" -Output file -OutputFile prompt.txt
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [ValidateSet("clipboard", "file", "stdout")]
    [string]$Output = "clipboard",

    [string]$OutputFile = "bootstrapped-prompt.txt"
)

$ErrorActionPreference = "Stop"

# Get repository root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Governance files to include
$BootstrapFiles = @(
    ".namespace/context/CONTEXT_SUMMARY.md",
    ".namespace/governance/SYSTEM_STANDARD.md",
    ".namespace/governance/AI_DEV_CONTRACT.md",
    ".namespace/testing/LOCK_RULES.md"
)

# Build bootstrapped prompt
$BootstrappedPrompt = @"
# ============================================================
# NAMESPACE GOVERNANCE BOOTSTRAP
# Auto-prepended by scripts/ai-prompt.ps1
# ============================================================

This prompt has been automatically bootstrapped with project governance.
You MUST comply with all rules in the following sections.

[NAMESPACE-BOOTSTRAP: VERIFIED]

"@

foreach ($file in $BootstrapFiles) {
    $fullPath = Join-Path $RepoRoot $file

    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        $BootstrappedPrompt += @"

# ------------------------------------------------------------
# FILE: $file
# ------------------------------------------------------------

$content

"@
    } else {
        Write-Warning "Missing bootstrap file: $file"
    }
}

$BootstrappedPrompt += @"

# ============================================================
# USER REQUEST
# ============================================================

$Prompt

# ============================================================
# RESPONSE REQUIREMENTS
# ============================================================

1. Verify compliance with SYSTEM_STANDARD.md before any code changes
2. Check LOCK_RULES.md before modifying core modules
3. Include [NAMESPACE-BOOTSTRAP: VERIFIED] in your response
4. Never suggest PM2 or other forbidden technologies
5. Use production HTTPS URLs for health checks, not localhost

"@

# Output the bootstrapped prompt
switch ($Output) {
    "clipboard" {
        $BootstrappedPrompt | Set-Clipboard
        Write-Host "Bootstrapped prompt copied to clipboard" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prompt length: $($BootstrappedPrompt.Length) characters" -ForegroundColor Gray
        Write-Host "Paste into your AI assistant to use." -ForegroundColor Gray
    }
    "file" {
        $BootstrappedPrompt | Out-File -FilePath $OutputFile -Encoding utf8
        Write-Host "Bootstrapped prompt saved to: $OutputFile" -ForegroundColor Green
    }
    "stdout" {
        Write-Output $BootstrappedPrompt
    }
}
