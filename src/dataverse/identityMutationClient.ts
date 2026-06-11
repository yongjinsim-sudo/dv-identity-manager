import { ExecutionResult, IdentityDefinitionDraft, PendingIdentityChange } from '../product/identityManagerTypes';
import { IdentityMetadataClient } from './identityMetadataClient';
import { DataverseHttpClient } from './dataverseHttpClient';

function systemUserSetName(principalType: string): string {
	return principalType === 'Team' ? 'teams' : 'systemusers';
}


function friendlyParticipationError(error: unknown, principalType: string): string {
	const raw = error instanceof Error ? error.message : String(error);
	if (/Microsoft managed component/i.test(raw) || /Cannot update current component/i.test(raw)) {
		return `Dataverse blocked this participation change because the selected ${principalType} is a Microsoft managed component. First-party / managed application users cannot always be modified through identity participation APIs. Choose an unmanaged/custom identity or review the assignment in Power Platform admin tooling. Raw detail: ${raw}`;
	}
	if (/Cannot assign roles or profiles to an access team/i.test(raw)) {
		return `Dataverse rejected this role participation update because the selected team is an access team. Access teams can participate through membership but cannot be assigned roles or profiles through this API. Raw detail: ${raw}`;
	}
	if (/0x80072562/i.test(raw)) {
		return `Dataverse rejected this identity participation update. The selected identity may be managed, protected, or not valid for this relationship. Raw detail: ${raw}`;
	}
	return raw;
}

function associationName(kind: PendingIdentityChange['kind'], principalType: string): string {
	if (kind === 'AssignRole' || kind === 'RemoveRole') {
		return principalType === 'Team' ? 'teamroles_association' : 'systemuserroles_association';
	}
	return 'teammembership_association';
}

export class IdentityMutationClient {
	constructor(
		private readonly client: DataverseHttpClient,
		private readonly metadataClient: IdentityMetadataClient,
		private readonly environmentUrl: string
	) {}

	async applyChanges(changes: PendingIdentityChange[]): Promise<ExecutionResult[]> {
		const results: ExecutionResult[] = [];
		for (const change of changes) {
			try {
				const identity = await this.metadataClient.resolveIdentity(change.draft.principalType, change.draft.identifier);
				if (!identity) {
					results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Failed', message: `${change.draft.principalType} not found: ${change.draft.identifier}` });
					continue;
				}
				if (change.kind === 'AssignRole' || change.kind === 'RemoveRole') {
					const role = await this.metadataClient.resolveRole(change.targetName);
					if (!role) {
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Failed', message: `Role not found: ${change.targetName}` });
						continue;
					}
					if (change.kind === 'AssignRole') {
						await this.associate(change.draft, identity.id, associationName(change.kind, change.draft.principalType), 'roles', role.id);
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Applied', message: `Assigned role ${role.name} to ${change.draft.identifier}.` });
					} else {
						await this.disassociate(change.draft, identity.id, associationName(change.kind, change.draft.principalType), role.id);
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Applied', message: `Removed role ${role.name} from ${change.draft.identifier}.` });
					}
					continue;
				}

				if (change.kind === 'AddTeamMembership' || change.kind === 'RemoveTeamMembership') {
					const team = await this.metadataClient.resolveTeam(change.targetName);
					if (!team) {
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Failed', message: `Team not found: ${change.targetName}` });
						continue;
					}
					if (change.kind === 'AddTeamMembership') {
						await this.associate(change.draft, team.id, associationName(change.kind, change.draft.principalType), 'systemusers', identity.id, 'teams');
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Applied', message: `Added ${change.draft.identifier} to team ${team.name}.` });
					} else {
						await this.disassociate(change.draft, team.id, associationName(change.kind, change.draft.principalType), identity.id, 'teams');
						results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Applied', message: `Removed ${change.draft.identifier} from team ${team.name}.` });
					}
					continue;
				}

				results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Skipped', message: 'Operation kind is not implemented in v0.1.0.' });
			} catch (error) {
				results.push({ draftId: change.draft.id, targetName: change.targetName, status: 'Failed', message: friendlyParticipationError(error, change.draft.principalType) });
			}
		}
		return results;
	}

	private async associate(draft: IdentityDefinitionDraft, ownerId: string, association: string, targetSet: string, targetId: string, ownerSetOverride?: string): Promise<void> {
		const ownerSet = ownerSetOverride ?? systemUserSetName(draft.principalType);
		await this.client.post(`/${ownerSet}(${ownerId})/${association}/$ref`, {
			'@odata.id': `${this.environmentUrl}/api/data/v9.2/${targetSet}(${targetId})`
		});
	}

	private async disassociate(draft: IdentityDefinitionDraft, ownerId: string, association: string, targetId: string, ownerSetOverride?: string): Promise<void> {
		const ownerSet = ownerSetOverride ?? systemUserSetName(draft.principalType);
		await this.client.delete(`/${ownerSet}(${ownerId})/${association}(${targetId})/$ref`);
	}
}
