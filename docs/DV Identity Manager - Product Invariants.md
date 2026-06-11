# DV Identity Manager — Product Invariants & Architectural Boundaries v0.1

## Purpose

DV Identity Manager manages Dataverse identity participation through a preview-first workflow.

It must remain a focused identity participation utility and must not evolve into a security analysis platform, RBAC simulator, or Dataverse administration suite.

---

## Core Invariant

> DVIM manages identity participation. DVIM does not determine identity authority.

Participation examples:

- User assigned to Role
- User member of Team
- Application User assigned to Role
- Team assigned to Role

Authority examples, explicitly out of scope:

- Read Account
- Write Contact
- Delete Case
- Append Opportunity
- Assign Lead

---

## Security Boundary

DVIM is not a security analysis tool.

DVIM must not become:

- Privilege Explorer
- Security Role Designer
- Privilege Matrix
- RBAC Simulator
- Access Calculator
- Effective Permissions Viewer

---

## Preview-First Invariant

Mandatory workflow:

```text
Import / Define
↓
Stage
↓
Validate
↓
Preview
↓
Apply
```

No direct mutation shortcuts are permitted.

---

## Supported v0.1 Participation Types

- User ↔ Role
- User ↔ Team
- Team ↔ Role
- Application User ↔ Role

---

## Relationship to DV Quick Run

DV Quick Run remains the investigation platform.

DVIM remains the participation management utility.

Future direction:

```text
DV Quick Run
↓
Identity Participation Drift
↓
Generate .dvim.json
↓
DV Identity Manager
↓
Preview
↓
Apply
```

---

## Final Principle

DV Identity Manager manages who participates.

DV Identity Manager does not determine what they are allowed to do.
