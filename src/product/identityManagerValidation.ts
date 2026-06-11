import { IdentityDefinitionDraft, IdentitySummary, PendingIdentityChange, RoleSummary, TeamSummary, ValidationIssue } from './identityManagerTypes';

function normalise(value: string): string {
	return value.trim().toLowerCase();
}

function splitList(value: string | undefined): string[] {
	return (value ?? '')
		.split(/\r?\n|;/)
		.map(item => item.trim())
		.filter(Boolean);
}

function hasIdentity(draft: IdentityDefinitionDraft, identities: IdentitySummary[]): boolean {
	const identifier = normalise(draft.identifier);
	return identities.some(identity => identity.principalType === draft.principalType && normalise(identity.identifier) === identifier);
}

function hasRole(roleName: string, roles: RoleSummary[]): boolean {
	const normalised = normalise(roleName);
	return roles.some(role => normalise(role.name) === normalised);
}

function hasTeam(teamName: string, teams: TeamSummary[]): boolean {
	const normalised = normalise(teamName);
	return teams.some(team => normalise(team.name) === normalised);
}

export function parseAssignRoles(draft: IdentityDefinitionDraft): string[] {
	return splitList(draft.roles);
}

export function parseAddTeams(draft: IdentityDefinitionDraft): string[] {
	return splitList(draft.teams);
}

export function parseRemoveRoles(draft: IdentityDefinitionDraft): string[] {
	return splitList(draft.removeRoles);
}

export function parseRemoveTeams(draft: IdentityDefinitionDraft): string[] {
	return splitList(draft.removeTeams);
}

export function validateDrafts(drafts: IdentityDefinitionDraft[], roles: RoleSummary[], teams: TeamSummary[], identities: IdentitySummary[]): { issues: ValidationIssue[]; pendingChanges: PendingIdentityChange[] } {
	const issues: ValidationIssue[] = [];
	const draftKeys = new Map<string, number>();

	for (const draft of drafts) {
		const identifier = draft.identifier.trim();
		let matchedIdentity: IdentitySummary | undefined;
		if (!identifier) {
			issues.push({ draftId: draft.id, severity: 'Error', message: 'Identity identifier is required.' });
		} else {
			matchedIdentity = identities.find(identity => identity.principalType === draft.principalType && normalise(identity.identifier) === normalise(identifier));
			if (identities.length && !matchedIdentity) {
				issues.push({ draftId: draft.id, severity: 'Warning', message: `${draft.principalType} was not found in the loaded identity list.` });
			}
		}

		const managedState = draft.managedState ?? matchedIdentity?.managedState;
		const managedSolutionName = draft.managedSolutionName ?? matchedIdentity?.managedSolutionName;
		if (managedState === 'Managed') {
			issues.push({
				draftId: draft.id,
				severity: 'Warning',
				message: `Managed component detected${managedSolutionName ? ` (${managedSolutionName})` : ''}. Dataverse may allow some membership changes and block some role changes at apply time.`
			});
		} else if (managedState === 'Unknown' && draft.principalType === 'ApplicationUser') {
			issues.push({
				draftId: draft.id,
				severity: 'Warning',
				message: 'Managed metadata not confirmed for this application user. Some first-party app-user role operations may still be blocked by Dataverse at apply time.'
			});
		}

		if (draft.principalType === 'Team' && matchedIdentity?.isAccessTeam) {
			issues.push({
				draftId: draft.id,
				severity: 'Warning',
				message: 'Access team detected. Dataverse may reject role assignment or removal for access teams.'
			});
		}

		const assignRoles = parseAssignRoles(draft);
		const addTeams = parseAddTeams(draft);
		const removeRoles = parseRemoveRoles(draft);
		const removeTeams = parseRemoveTeams(draft);
		if (!assignRoles.length && !addTeams.length && !removeRoles.length && !removeTeams.length) {
			issues.push({ draftId: draft.id, severity: 'Error', message: 'At least one role or team membership change is required.' });
		}

		if (draft.principalType === 'Team' && (addTeams.length || removeTeams.length)) {
			issues.push({ draftId: draft.id, severity: 'Warning', message: 'Team-to-team membership is unsupported. Team rows only support role assignments.' });
		}

		for (const role of [...assignRoles, ...removeRoles]) {
			if (roles.length && !hasRole(role, roles)) {
				issues.push({ draftId: draft.id, severity: 'Warning', message: `Role not found: ${role}.` });
			}
		}

		for (const team of [...addTeams, ...removeTeams]) {
			if (teams.length && !hasTeam(team, teams)) {
				issues.push({ draftId: draft.id, severity: 'Warning', message: `Team not found: ${team}.` });
			}
		}

		const key = `${draft.principalType}::${normalise(identifier)}::${normalise([...assignRoles, ...addTeams, ...removeRoles, ...removeTeams].join('|'))}`;
		draftKeys.set(key, (draftKeys.get(key) ?? 0) + 1);
	}

	for (const draft of drafts) {
		const key = `${draft.principalType}::${normalise(draft.identifier)}::${normalise([...parseAssignRoles(draft), ...parseAddTeams(draft), ...parseRemoveRoles(draft), ...parseRemoveTeams(draft)].join('|'))}`;
		if ((draftKeys.get(key) ?? 0) > 1) {
			issues.push({ draftId: draft.id, severity: 'Error', message: 'Duplicate participation definition for the same principal and target entries.' });
		}
	}

	const pendingChanges: PendingIdentityChange[] = [];
	for (const draft of drafts) {
		const draftIssues = issues.filter(issue => issue.draftId === draft.id);
		if (draftIssues.some(issue => issue.severity === 'Error')) {
			continue;
		}
		for (const role of parseAssignRoles(draft)) {
			pendingChanges.push({ kind: 'AssignRole', draft, targetName: role, issues: draftIssues });
		}
		for (const role of parseRemoveRoles(draft)) {
			pendingChanges.push({ kind: 'RemoveRole', draft, targetName: role, issues: draftIssues });
		}
		if (draft.principalType !== 'Team') {
			for (const team of parseAddTeams(draft)) {
				pendingChanges.push({ kind: 'AddTeamMembership', draft, targetName: team, issues: draftIssues });
			}
			for (const team of parseRemoveTeams(draft)) {
				pendingChanges.push({ kind: 'RemoveTeamMembership', draft, targetName: team, issues: draftIssues });
			}
		}
	}

	return { issues, pendingChanges };
}
