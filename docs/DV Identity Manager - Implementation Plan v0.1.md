# DV Identity Manager — Implementation Plan v0.1

## Release Theme

**Preview-First Identity Participation Administration**

DV Identity Manager provides focused administration of Dataverse identity participation directly inside VS Code.

The utility supports staged definitions, validation, preview, and explicit apply semantics.

---

## Scope

### Included

- User → Role assignments
- User → Team memberships
- Team → Role assignments
- Application User → Role assignments
- CSV import/export
- JSON import/export
- Preview-first workflow
- Environment-aware safety indicators
- Execution reporting

### Excluded

- Role creation
- Role privilege editing
- Privilege matrix viewing
- Effective permission calculation
- RBAC simulation
- Business Unit reassignment
- Team lifecycle management
- Security diagnostics

---

## Product Boundary

DV Identity Manager is an identity participation utility.

It is not a security analysis tool.

---

## Utility Pattern

DVIM reuses the DV ForgeLab utility layout established by DV Attribute Factory:

- Signature header card
- Summary cards
- Environment pills
- Import/export toolbar
- Card-based definition editor
- Preview-first apply surface
- Result reporting
- DV ForgeLab footer

---

## Artifact Direction

DVIM introduces `.dvim.json`-style identity participation definitions.

These artifacts are intended to be source-control friendly and future-compatible with DV Quick Run identity participation drift exports.
