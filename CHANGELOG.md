# Change Log

All notable changes to the "DV Identity Manager" extension will be documented in this file.

## [0.1.0] - Initial identity participation scaffold

### Added

- DV Identity Manager VS Code command and branded DV ForgeLab webview.
- Shared DV ForgeLab environment connection support.
- Identity Browser for searching users, teams, and application users.
- Current participation view for loaded identities.
- Browser-driven staging for role assignments/removals and team membership additions/removals.
- Secondary definition staging area for imported/manual participation definitions.
- CSV import and export.
- JSON import and export.
- Preview-first validation and explicit apply workflow.
- Identity metadata loading for users, teams, application users, and roles.
- Initial browser and definition support for:
  - User → Role assignments
  - User → Team memberships
  - Team → Role assignments
  - Application User → Role assignments
- Execution summary for applied, skipped, and failed participation changes.
- Local import summary inside Definition staging.
- Duplicate-aware import and browser staging merge.
- Managed application user warning semantics without blocking all participation operations.
- Access team warning semantics and clearer Dataverse rejection messages.

### Boundaries

- Manages identity participation only.
- Does not create security roles.
- Does not edit role privileges.
- Does not calculate effective permissions.
- Does not simulate RBAC.
- Does not move business units.
- Does not perform security diagnostics.
