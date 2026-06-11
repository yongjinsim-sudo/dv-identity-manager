# DV Identity Manager

Manage Dataverse identity participation inside VS Code.

**DV Identity Manager** is a focused DV ForgeLab utility for searching Dataverse identities, reviewing participation, staging assignment/membership changes, previewing them, and applying them deliberately.

It is intentionally about **participation**, not authority.

DV Identity Manager manages assignments and memberships. It does not edit privileges, calculate effective access, simulate RBAC, or determine security authority.

## Highlights

- Identity Browser for users, teams, and application users
- Current participation view for roles and team memberships
- Browser-driven staging for assign/remove operations
- Secondary CSV/JSON definition import and export
- CSV import and export
- JSON import and export
- Preview-first validation workflow
- Environment-aware safety indicators
- Explicit apply semantics
- Execution reporting and outcome tracking
- Shared DV ForgeLab Dataverse environment settings

## Preview-first workflow

```text
Connect
↓
Search identity or import definitions
↓
Load participation
↓
Stage participation changes
↓
Validate
↓
Preview
↓
Apply participation changes
↓
Review execution report
```

## Supported v0.1 participation types

- User → Role assignments
- User → Team memberships
- Team → Role assignments
- Application User → Role assignments

## Boundary

DV Identity Manager is intentionally a participation manager, not a security analysis tool.

It does not:

- Create roles
- Edit role privileges
- Display privilege matrices
- Calculate effective permissions
- Simulate RBAC
- Move business units
- Manage business unit hierarchy
- Perform security diagnostics
- Recommend access changes

## Shared DV ForgeLab environment settings

```json
"dvForgeLab.environments": [
  {
    "name": "DEV",
    "url": "https://org.crm6.dynamics.com",
    "tenantId": "optional-tenant-id"
  }
]
```

## Command

```text
DV Identity Manager: Open Identity Manager
```

## Philosophy

DV Identity Manager follows the DV ForgeLab preview-first invariant.

Identity participation changes are staged locally, validated, previewed, and explicitly applied by the user. Dataverse identity participation is never changed without an explicit preview and confirmation step.

## Future Direction

Future DV Quick Run comparison providers may generate `.dvim.json` identity definition artifacts from observed identity participation drift.

DV Quick Run remains responsible for investigation.

DV Identity Manager remains responsible for preview-first participation administration.

## Built By

Built by **DV ForgeLab**.

**DV Quick Run** remains the flagship Dataverse investigation workbench.

VS Code Marketplace:

https://marketplace.visualstudio.com/items?itemName=dv-forgelab.dv-quick-run

## Validation Notes

DVIM validates participation definitions before preview and apply. Some Dataverse restrictions are only fully enforced by the platform at apply time.

- Managed application users are surfaced as warnings because Dataverse may allow some membership changes while blocking some role changes.
- Access teams are surfaced as warnings because Dataverse may reject role assignment or removal for access teams.
- DVIM does not bypass Dataverse protection. Platform errors are reported in execution results.
