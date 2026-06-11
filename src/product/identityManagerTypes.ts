export type EnvironmentSafety = 'None' | 'Grey' | 'Amber' | 'Red';

export type IdentityManagerEnvironmentViewModel = {
	label: string;
	url?: string;
	state: 'NotConnected' | 'Connected';
	safety: EnvironmentSafety;
	safetyLabel: string;
};

export type PrincipalType = 'User' | 'Team' | 'ApplicationUser';

export type ManagedState = 'Managed' | 'Unmanaged' | 'Unknown';

export type ParticipationMode = 'Additive' | 'Exact';

export type IdentityDefinitionDraft = {
	id: string;
	principalType: PrincipalType;
	identifier: string;
	displayName?: string;
	roles?: string;
	teams?: string;
	removeRoles?: string;
	removeTeams?: string;
	mode: ParticipationMode;
	description?: string;
	managedState?: ManagedState;
	managedSolutionName?: string;
	teamType?: number;
	teamTypeLabel?: string;
	isAccessTeam?: boolean;
};

export type IdentitySummary = {
	id: string;
	principalType: PrincipalType;
	identifier: string;
	displayName?: string;
	businessUnitName?: string;
	managedState?: ManagedState;
	managedSolutionName?: string;
	managedReason?: string;
	teamType?: number;
	teamTypeLabel?: string;
	isAccessTeam?: boolean;
};

export type RoleSummary = {
	id: string;
	name: string;
	businessUnitName?: string;
};

export type TeamSummary = {
	id: string;
	name: string;
	businessUnitName?: string;
	teamType?: number;
	teamTypeLabel?: string;
	isAccessTeam?: boolean;
};

export type IdentityParticipationSnapshot = {
	identity: IdentitySummary;
	roles: RoleSummary[];
	teams: TeamSummary[];
};

export type ValidationIssue = {
	draftId: string;
	severity: 'Error' | 'Warning';
	message: string;
};

export type ParticipationOperationKind =
	| 'AssignRole'
	| 'AddTeamMembership'
	| 'RemoveRole'
	| 'RemoveTeamMembership';

export type PendingIdentityChange = {
	kind: ParticipationOperationKind;
	draft: IdentityDefinitionDraft;
	targetName: string;
	issues: ValidationIssue[];
};

export type ExecutionResult = {
	draftId: string;
	targetName: string;
	status: 'Applied' | 'Skipped' | 'Failed';
	message: string;
};

export type IdentityManagerViewModel = {
	productName: string;
	subtitle: string;
	environment: IdentityManagerEnvironmentViewModel;
	roles: RoleSummary[];
	teams: TeamSummary[];
	identities: IdentitySummary[];
	identitySearchQuery: string;
	selectedParticipation?: IdentityParticipationSnapshot;
	drafts: IdentityDefinitionDraft[];
	pendingChanges: PendingIdentityChange[];
	validationIssues: ValidationIssue[];
	executionResults: ExecutionResult[];
	previewOpen: boolean;
	summary: {
		identityCount: number;
		roleCount: number;
		teamCount: number;
		draftCount: number;
		pendingChangeCount: number;
		errorCount: number;
		warningCount: number;
	};
	message?: {
		kind: 'Info' | 'Warning' | 'Error';
		text: string;
	};
	definitionMessage?: {
		kind: 'Info' | 'Warning' | 'Error';
		text: string;
	};
};
