@echo off
REM ============================================================
REM Inspire Pipeline 8.0 - Folder Structure Creation Script
REM ============================================================
REM This script creates the complete .pipeline folder structure
REM for the Inspire 8.0 execution and orchestration engine.
REM ============================================================

setlocal EnableDelayedExpansion

set "BASE_DIR=C:\data\JubileeEnterprise.com Bibleweb\.reactor\.pipeline"

echo.
echo ============================================================
echo  Inspire Pipeline 8.0 - Folder Structure Setup
echo ============================================================
echo.
echo Creating pipeline folders at: %BASE_DIR%
echo.

REM ============================================================
REM 1. ACTIVATION - Persona ignition and authority loading
REM ============================================================
echo [1/10] Creating activation folders...
mkdir "%BASE_DIR%\activation" 2>nul
mkdir "%BASE_DIR%\activation\load-authority" 2>nul
mkdir "%BASE_DIR%\activation\load-persona" 2>nul
mkdir "%BASE_DIR%\activation\load-mission" 2>nul
mkdir "%BASE_DIR%\activation\load-voice" 2>nul
mkdir "%BASE_DIR%\activation\load-guardrails" 2>nul
mkdir "%BASE_DIR%\activation\finalize-activation" 2>nul

REM ============================================================
REM 2. PROMPT PIPELINES - Ordered, repeatable prompt execution
REM ============================================================
echo [2/10] Creating prompt-pipelines folders...
mkdir "%BASE_DIR%\prompt-pipelines" 2>nul
mkdir "%BASE_DIR%\prompt-pipelines\manifests" 2>nul
mkdir "%BASE_DIR%\prompt-pipelines\templates" 2>nul
mkdir "%BASE_DIR%\prompt-pipelines\execution" 2>nul

REM ============================================================
REM 3. ROUTING - Model selection and cost governance
REM ============================================================
echo [3/10] Creating routing folders...
mkdir "%BASE_DIR%\routing" 2>nul
mkdir "%BASE_DIR%\routing\rules" 2>nul
mkdir "%BASE_DIR%\routing\escalation" 2>nul
mkdir "%BASE_DIR%\routing\usage-limits" 2>nul

REM ============================================================
REM 4. EXECUTION - LLM invocation and response handling
REM ============================================================
echo [4/10] Creating execution folders...
mkdir "%BASE_DIR%\execution" 2>nul
mkdir "%BASE_DIR%\execution\render" 2>nul
mkdir "%BASE_DIR%\execution\invoke" 2>nul
mkdir "%BASE_DIR%\execution\capture" 2>nul
mkdir "%BASE_DIR%\execution\postprocess" 2>nul

REM ============================================================
REM 5. MEMORY WRITEBACK - Durable memory summarization and storage
REM ============================================================
echo [5/10] Creating memory-writeback folders...
mkdir "%BASE_DIR%\memory-writeback" 2>nul
mkdir "%BASE_DIR%\memory-writeback\session-summaries" 2>nul
mkdir "%BASE_DIR%\memory-writeback\key-decisions" 2>nul
mkdir "%BASE_DIR%\memory-writeback\scripture-references" 2>nul

REM ============================================================
REM 6. AUDITS - Drift detection, doctrine alignment, integrity checks
REM ============================================================
echo [6/10] Creating audits folders...
mkdir "%BASE_DIR%\audits" 2>nul
mkdir "%BASE_DIR%\audits\reports" 2>nul
mkdir "%BASE_DIR%\audits\doctrine-alignment" 2>nul
mkdir "%BASE_DIR%\audits\persona-drift" 2>nul
mkdir "%BASE_DIR%\audits\activation-integrity" 2>nul

REM ============================================================
REM 7. EMBEDDINGS - Representation and vector preparation
REM ============================================================
echo [7/10] Creating embeddings folders...
mkdir "%BASE_DIR%\embeddings" 2>nul
mkdir "%BASE_DIR%\embeddings\prompts" 2>nul
mkdir "%BASE_DIR%\embeddings\activation-context" 2>nul
mkdir "%BASE_DIR%\embeddings\vectors" 2>nul

REM ============================================================
REM 8. LOGGING - Detailed logging destinations
REM ============================================================
echo [8/10] Creating logging folders...
mkdir "%BASE_DIR%\logs" 2>nul
mkdir "%BASE_DIR%\logs\activation-events" 2>nul
mkdir "%BASE_DIR%\logs\routing-decisions" 2>nul
mkdir "%BASE_DIR%\logs\execution-metrics" 2>nul
mkdir "%BASE_DIR%\logs\errors" 2>nul

REM ============================================================
REM 9. STATE MANAGEMENT - Enable replay, resume, and debugging
REM ============================================================
echo [9/10] Creating state-management folders...
mkdir "%BASE_DIR%\state" 2>nul

REM ============================================================
REM 10. CONTROL - Interface and CLI support
REM ============================================================
echo [10/10] Creating control folders...
mkdir "%BASE_DIR%\control" 2>nul
mkdir "%BASE_DIR%\control\cli" 2>nul
mkdir "%BASE_DIR%\control\tasks" 2>nul
mkdir "%BASE_DIR%\control\scripted-pipelines" 2>nul

echo.
echo ============================================================
echo  Pipeline folder structure created successfully!
echo ============================================================
echo.
echo Created folders:
echo   - activation (6 stage folders)
echo   - prompt-pipelines (manifests, templates, execution)
echo   - routing (rules, escalation, usage-limits)
echo   - execution (render, invoke, capture, postprocess)
echo   - memory-writeback (session-summaries, key-decisions, scripture-references)
echo   - audits (reports, doctrine-alignment, persona-drift, activation-integrity)
echo   - embeddings (prompts, activation-context, vectors)
echo   - logs (activation-events, routing-decisions, execution-metrics, errors)
echo   - state
echo   - control (cli, tasks, scripted-pipelines)
echo.

pause
