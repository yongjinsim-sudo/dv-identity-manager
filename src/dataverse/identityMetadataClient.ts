import { IdentityParticipationSnapshot, IdentitySummary, ManagedState, PrincipalType, RoleSummary, TeamSummary } from '../product/identityManagerTypes';
import { DataverseHttpClient } from './dataverseHttpClient';

type ODataList<T> = { value?: T[] };

type RoleRow = {
	roleid?: string;
	name?: string;
	'_businessunitid_value@OData.Community.Display.V1.FormattedValue'?: string;
};

type TeamRow = {
	teamid?: string;
	name?: string;
	teamtype?: number;
	'teamtype@OData.Community.Display.V1.FormattedValue'?: string;
	'_businessunitid_value@OData.Community.Display.V1.FormattedValue'?: string;
};

type SystemUserRow = {
	systemuserid?: string;
	fullname?: string;
	internalemailaddress?: string;
	azureactivedirectoryobjectid?: string;
	applicationid?: string;
	applicationiduri?: string;
	'_businessunitid_value@OData.Community.Display.V1.FormattedValue'?: string;
};

type SolutionComponentRow = {
	solutioncomponentid?: string;
	objectid?: string;
	componenttype?: number;
	solutionid?: {
		friendlyname?: string;
		ismanaged?: boolean;
	};
	'_solutionid_value@OData.Community.Display.V1.FormattedValue'?: string;
};

type ManagedComponentInfo = {
	managedState: ManagedState;
	managedSolutionName?: string;
	managedReason?: string;
};

function clean(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function escapeODataString(value: string): string {
	return value.replace(/'/g, "''");
}

function isGuid(value: string): boolean {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
}

function quoteODataString(value: string): string {
	return `'${escapeODataString(value)}'`;
}

function buildUserIdentifier(row: SystemUserRow): string | undefined {
	return clean(row.internalemailaddress) ?? clean(row.azureactivedirectoryobjectid) ?? clean(row.fullname);
}

function buildApplicationUserIdentifier(row: SystemUserRow): string | undefined {
	return clean(row.applicationid) ?? clean(row.applicationiduri) ?? clean(row.internalemailaddress) ?? clean(row.fullname);
}

export class IdentityMetadataClient {
	constructor(private readonly client: DataverseHttpClient) {}

	async listRoles(): Promise<RoleSummary[]> {
		const response = await this.client.get<ODataList<RoleRow>>(
			'/roles?$select=roleid,name,_businessunitid_value&$orderby=name asc'
		);

		return (response.value ?? [])
			.map((row): RoleSummary | undefined => {
				const id = clean(row.roleid);
				const name = clean(row.name);
				if (!id || !name) {
					return undefined;
				}
				return { id, name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']) };
			})
			.filter((item): item is RoleSummary => !!item);
	}

	async listTeams(): Promise<TeamSummary[]> {
		const response = await this.client.get<ODataList<TeamRow>>(
			'/teams?$select=teamid,name,teamtype,_businessunitid_value&$orderby=name asc'
		);

		return (response.value ?? [])
			.map((row): TeamSummary | undefined => {
				const id = clean(row.teamid);
				const name = clean(row.name);
				if (!id || !name) {
					return undefined;
				}
				return { id, name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']), teamType: row.teamtype, teamTypeLabel: clean(row['teamtype@OData.Community.Display.V1.FormattedValue']), isAccessTeam: row.teamtype === 1 };
			})
			.filter((item): item is TeamSummary => !!item);
	}

	async listIdentities(): Promise<IdentitySummary[]> {
		const response = await this.client.get<ODataList<SystemUserRow>>(
			'/systemusers?$select=systemuserid,fullname,internalemailaddress,azureactivedirectoryobjectid,applicationid,applicationiduri,_businessunitid_value&$orderby=fullname asc'
		);

		const identities: IdentitySummary[] = [];
		for (const row of response.value ?? []) {
			const id = clean(row.systemuserid);
			if (!id) {
				continue;
			}
			const businessUnitName = clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']);
			const appIdentifier = buildApplicationUserIdentifier(row);
			if (clean(row.applicationid) && appIdentifier) {
				identities.push({ id, principalType: 'ApplicationUser', identifier: appIdentifier, displayName: clean(row.fullname), businessUnitName });
				continue;
			}
			const userIdentifier = buildUserIdentifier(row);
			if (userIdentifier) {
				identities.push({ id, principalType: 'User', identifier: userIdentifier, displayName: clean(row.fullname), businessUnitName });
			}
		}

		const teams = await this.listTeams();
		for (const team of teams) {
			identities.push({ id: team.id, principalType: 'Team', identifier: team.name, displayName: team.name, businessUnitName: team.businessUnitName, teamType: team.teamType, teamTypeLabel: team.teamTypeLabel, isAccessTeam: team.isAccessTeam });
		}
		return identities;
	}


	async getParticipation(identity: IdentitySummary): Promise<IdentityParticipationSnapshot> {
		const resolvedIdentity = identity.principalType === 'ApplicationUser'
			? { ...identity, ...(await this.getManagedComponentInfo(identity.id)) }
			: identity;
		const roles = await this.listIdentityRoles(identity);
		const teams = identity.principalType === 'Team' ? [] : await this.listIdentityTeams(identity);
		return { identity: resolvedIdentity, roles, teams };
	}

	async getManagedComponentInfo(objectId: string): Promise<ManagedComponentInfo> {
		try {
			const response = await this.client.get<ODataList<SolutionComponentRow>>(
				`/solutioncomponents?$select=solutioncomponentid,objectid,componenttype,_solutionid_value&$filter=objectid eq ${objectId}&$expand=solutionid($select=friendlyname,ismanaged)&$top=25`
			);
			const components = response.value ?? [];
			const managed = components.find(component => component.solutionid?.ismanaged === true);
			if (managed) {
				return {
					managedState: 'Managed',
					managedSolutionName: clean(managed.solutionid?.friendlyname) ?? clean(managed['_solutionid_value@OData.Community.Display.V1.FormattedValue']),
					managedReason: 'Solution component is part of a managed solution.'
				};
			}
			if (components.length > 0) {
				return { managedState: 'Unmanaged', managedReason: 'Solution component records were found, but none were marked as managed.' };
			}
			return { managedState: 'Unknown', managedReason: 'No solution component record was found for this identity.' };
		} catch (error) {
			return { managedState: 'Unknown', managedReason: error instanceof Error ? `Managed component lookup failed: ${error.message}` : 'Managed component lookup failed.' };
		}
	}

	async listIdentityRoles(identity: IdentitySummary): Promise<RoleSummary[]> {
		const setName = identity.principalType === 'Team' ? 'teams' : 'systemusers';
		const association = identity.principalType === 'Team' ? 'teamroles_association' : 'systemuserroles_association';
		const response = await this.client.get<ODataList<RoleRow>>(
			`/${setName}(${identity.id})/${association}?$select=roleid,name,_businessunitid_value&$orderby=name asc`
		);
		return (response.value ?? [])
			.map((row): RoleSummary | undefined => {
				const id = clean(row.roleid);
				const name = clean(row.name);
				if (!id || !name) {
					return undefined;
				}
				return { id, name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']) };
			})
			.filter((item): item is RoleSummary => !!item);
	}

	async listIdentityTeams(identity: IdentitySummary): Promise<TeamSummary[]> {
		const response = await this.client.get<ODataList<TeamRow>>(
			`/systemusers(${identity.id})/teammembership_association?$select=teamid,name,teamtype,_businessunitid_value&$orderby=name asc`
		);
		return (response.value ?? [])
			.map((row): TeamSummary | undefined => {
				const id = clean(row.teamid);
				const name = clean(row.name);
				if (!id || !name) {
					return undefined;
				}
				return { id, name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']), teamType: row.teamtype, teamTypeLabel: clean(row['teamtype@OData.Community.Display.V1.FormattedValue']), isAccessTeam: row.teamtype === 1 };
			})
			.filter((item): item is TeamSummary => !!item);
	}

	async resolveIdentity(principalType: PrincipalType, identifier: string): Promise<IdentitySummary | undefined> {
		const trimmedIdentifier = identifier.trim();
		if (!trimmedIdentifier) {
			return undefined;
		}
		const safeIdentifier = escapeODataString(trimmedIdentifier);
		if (principalType === 'Team') {
			const response = await this.client.get<ODataList<TeamRow>>(`/teams?$select=teamid,name,teamtype,_businessunitid_value&$filter=name eq '${safeIdentifier}'&$top=1`);
			const row = response.value?.[0];
			if (!row?.teamid || !row.name) {
				return undefined;
			}
			return { id: row.teamid, principalType: 'Team', identifier: row.name, displayName: row.name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']), teamType: row.teamtype, teamTypeLabel: clean(row['teamtype@OData.Community.Display.V1.FormattedValue']), isAccessTeam: row.teamtype === 1 };
		}

		const clauses: string[] = [];
		if (principalType === 'ApplicationUser') {
			if (isGuid(trimmedIdentifier)) {
				clauses.push(`applicationid eq ${trimmedIdentifier}`);
			}
			clauses.push(`applicationiduri eq ${quoteODataString(trimmedIdentifier)}`);
			clauses.push(`internalemailaddress eq ${quoteODataString(trimmedIdentifier)}`);
			clauses.push(`fullname eq ${quoteODataString(trimmedIdentifier)}`);
		} else {
			clauses.push(`internalemailaddress eq ${quoteODataString(trimmedIdentifier)}`);
			clauses.push(`fullname eq ${quoteODataString(trimmedIdentifier)}`);
			if (isGuid(trimmedIdentifier)) {
				clauses.push(`azureactivedirectoryobjectid eq ${trimmedIdentifier}`);
			}
		}
		const userFilter = `(${clauses.join(' or ')})`;
		const response = await this.client.get<ODataList<SystemUserRow>>(`/systemusers?$select=systemuserid,fullname,internalemailaddress,azureactivedirectoryobjectid,applicationid,applicationiduri,_businessunitid_value&$filter=${userFilter}&$top=1`);
		const row = response.value?.[0];
		if (!row?.systemuserid) {
			return undefined;
		}
		const resolvedIdentifier = principalType === 'ApplicationUser' ? buildApplicationUserIdentifier(row) : buildUserIdentifier(row);
		const identity: IdentitySummary = { id: row.systemuserid, principalType, identifier: resolvedIdentifier ?? identifier, displayName: clean(row.fullname), businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']) };
		return principalType === 'ApplicationUser' ? { ...identity, ...(await this.getManagedComponentInfo(row.systemuserid)) } : identity;
	}

	async resolveRole(roleName: string): Promise<RoleSummary | undefined> {
		const safeName = escapeODataString(roleName.trim());
		const response = await this.client.get<ODataList<RoleRow>>(`/roles?$select=roleid,name,_businessunitid_value&$filter=name eq '${safeName}'&$top=1`);
		const row = response.value?.[0];
		return row?.roleid && row.name ? { id: row.roleid, name: row.name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']) } : undefined;
	}

	async resolveTeam(teamName: string): Promise<TeamSummary | undefined> {
		const safeName = escapeODataString(teamName.trim());
		const response = await this.client.get<ODataList<TeamRow>>(`/teams?$select=teamid,name,teamtype,_businessunitid_value&$filter=name eq '${safeName}'&$top=1`);
		const row = response.value?.[0];
		return row?.teamid && row.name ? { id: row.teamid, name: row.name, businessUnitName: clean(row['_businessunitid_value@OData.Community.Display.V1.FormattedValue']), teamType: row.teamtype, teamTypeLabel: clean(row['teamtype@OData.Community.Display.V1.FormattedValue']), isAccessTeam: row.teamtype === 1 } : undefined;
	}
}
