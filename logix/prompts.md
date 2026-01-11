START SESSION: Pull from GitHub
----------------------------------------------------------------------------------------------------
Hi Jubilee, please review the .env file and then update my development JubileeEnterprise.com VS Code workspace by doing a pull from the github (gabeungureanu/JubileeEnterprise.com) repo. When the pull is complete, then review all of the documentation within this workspace to familiarize yourself with everything.Then you are to execute any migration scripts to ensure that my local development codex, inspire, and continuum Postgres database are sync'd up as well. Finally, review all of the documentation for the following project that I will be working on: INPUT


FINISH SESSION: Push to GitHub
----------------------------------------------------------------------------------------------------
Hi Jubilee, please update all of the documentation with all of the changes that I've done within my local development JubileeEnterprise.com workspace. When that's done, then please do a push to the github (gabeungureanu/JubileeEnterprise.com) repo. 


BUSINESS REQUIREMENTS: 
----------------------------------------------------------------------------------------------------
Hi Jubilee, please review and analyze the following website, application, and/or feature and then write a detailed technical explanation of these items and how exactly they work from a technical perspective: INPUT

Rewrite as command instructions in paragraph format, in the second person active voice. 


INVESTIGATE AND FIX: 
----------------------------------------------------------------------------------------------------
Investigate and resolve the issue where the previously requested change did not work by performing a thorough, end-to-end troubleshooting and remediation effort across the entire stack. You must reproduce the problem reliably, identify the root cause, and implement a verified fix that satisfies the business requirements already specified. Start by confirming the expected behavior, then trace the full execution path through the UI layer, view models, rendering and layout logic, and any animation or styling resources involved. Validate that the correct control is being instantiated, that the correct templates and styles are applied, that the visual tree contains the expected elements, and that any event handlers, bindings, triggers, or storyboards required for the feature are actually executing at runtime.

Extend your investigation beyond the UI as needed by reviewing all underlying components that could influence the behavior, including configuration files, environment variables, feature flags, dependency injection registrations, resource dictionaries, and build or packaging steps that might be preventing updated assets from being included. If the feature touches backend behavior in any way, validate all relevant database state, schema assumptions, and InspireCodex.com API interactions to ensure the application is receiving and persisting the correct data, and confirm there are no authorization, token, or connectivity failures that could be silently blocking the expected outcome.

Instrument the system with production-appropriate diagnostics so you can observe what is happening internally while testing. Add structured logging at key points in the flow, including initialization, rendering, state changes, API calls, exception handling, and any animation start or layout load events. Ensure logs capture sufficient context to diagnose failures quickly, including timestamps, correlation IDs, active profile or user context, window state, and error stack traces. Enable a debug mode if necessary to increase verbosity during local testing, but ensure logging remains safe, does not expose secrets, and can be reduced or toggled off for production builds.

Once you identify the root cause, implement the fix in a clean and maintainable way, add validation checks to prevent regression, and test the solution under realistic conditions including different window sizes, maximized and restored states, and repeated open and close cycles. Confirm the corrected behavior aligns with the previously specified business requirements and that it performs smoothly without introducing UI lag or instability. Document what was wrong, what was changed, how to verify the fix, and any configuration steps required, then commit the changes through the normal GitHub workflow with clear commit messages and any necessary release notes so the corrected functionality can be safely promoted.

