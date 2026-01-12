DEVELOPMENT ENVIRONMENT: 

Treat this current Visual Studio Code environment strictly as a development environment. All implementation, testing, and validation must be performed against the development Postgres database server only, using development credentials, schemas, and configuration values. Under no circumstances should production database connections, production credentials, or production API keys be used during this phase. All database migrations, schema changes, and test data must be clearly scoped and labeled as development-only until explicitly promoted.

Use the official GitHub repository as the single source of truth for all code changes. At the start of each task, pull the latest changes from the designated development branch to ensure alignment with the most recent codebase. All feature work, bug fixes, schema updates, and configuration changes must be committed incrementally with clear, descriptive commit messages that explain the purpose and scope of each change. Follow the existing branching and pull request conventions defined for the repository.

When implementing features that interact with Postgres, Codex tables, or the InspireCodex.com API, ensure all database queries, migrations, and API integrations are tested locally and against the development environment before being committed. Any required schema changes must be included as versioned migration scripts and checked into the repository alongside the application code so that environments can be reproduced deterministically.

After completing development and validation, push all finalized changes back to GitHub and open a pull request targeting the appropriate integration or release branch. The pull request must include a concise summary of changes, a list of affected components, and any required deployment or migration notes needed for promotion to production. No direct commits to production branches are permitted without review and explicit approval.

Ensure that the codebase remains production-ready at all times, even while operating in development mode. Configuration differences between development and production must be handled through environment variables or configuration files, not hardcoded values. The goal is for the production deployment process to consist solely of pulling the approved GitHub changes, applying migrations, and switching environment configuration without requiring code rewrites.

All work should assume a standard CI/CD flow where GitHub is the handoff point between development and production. Once changes are merged and approved, they will be published to the production environment through the established deployment pipeline. Your responsibility in this phase is to ensure correctness, stability, documentation, and clean Git history so that promotion to production is safe, predictable, and repeatable.

DATABASE:
codex       = database for all applications that runs all Jubilee products (browser, etc.) 
inspire     = database for the 12 Inspire Family personas data (books, messages, webpages, etc.)
continuum   = database for all users that use any products/services within the Jubilee ecosystem.
flywheel    = database for the Jubilee Algo application. (pending)

DATA API: 
InspireCodex.com API        = endpoints for access to the codex and inspire databases
InspireContinuum.com API    = endpoints for access to the continuum, codex, and inspire databases.

PROJECTS: 
JubileeBrowser.wpf          = Gabriel
JubileeOutlook.wpf          = Sandeep
JubileeInspire.ios          = Sunil