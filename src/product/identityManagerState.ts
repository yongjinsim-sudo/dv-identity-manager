import { ExecutionResult, IdentityManagerEnvironmentViewModel, IdentityDefinitionDraft, IdentityParticipationSnapshot, IdentitySummary, PendingIdentityChange, RoleSummary, TeamSummary, ValidationIssue } from './identityManagerTypes';

export type IdentityManagerState = {
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
	message?: { kind: 'Info' | 'Warning' | 'Error'; text: string };
	definitionMessage?: { kind: 'Info' | 'Warning' | 'Error'; text: string };
};

export function createInitialIdentityManagerState(): IdentityManagerState {
	return {
		environment: {
			label: 'Not connected',
			state: 'NotConnected',
			safety: 'None',
			safetyLabel: 'No environment selected'
		},
		roles: [],
		teams: [],
		identities: [],
		identitySearchQuery: '',
		drafts: [],
		pendingChanges: [],
		validationIssues: [],
		executionResults: [],
		previewOpen: false
	};
}
