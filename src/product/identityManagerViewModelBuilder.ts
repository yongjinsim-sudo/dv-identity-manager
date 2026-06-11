import { IdentityManagerState } from './identityManagerState';
import { IdentityManagerViewModel } from './identityManagerTypes';

export function buildIdentityManagerViewModel(state: IdentityManagerState): IdentityManagerViewModel {
	return {
		productName: 'DV Identity Manager',
		subtitle: 'Manage Dataverse identity participation with preview-first validation.',
		environment: state.environment,
		roles: state.roles,
		teams: state.teams,
		identities: state.identities,
		identitySearchQuery: state.identitySearchQuery,
		selectedParticipation: state.selectedParticipation,
		drafts: state.drafts,
		pendingChanges: state.pendingChanges,
		validationIssues: state.validationIssues,
		executionResults: state.executionResults,
		previewOpen: state.previewOpen,
		summary: {
			identityCount: state.identities.length,
			roleCount: state.roles.length,
			teamCount: state.teams.length,
			draftCount: state.drafts.length,
			pendingChangeCount: state.pendingChanges.length,
			errorCount: state.validationIssues.filter(issue => issue.severity === 'Error').length,
			warningCount: state.validationIssues.filter(issue => issue.severity === 'Warning').length
		},
		message: state.message,
		definitionMessage: state.definitionMessage
	};
}
