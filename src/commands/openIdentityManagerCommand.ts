import * as vscode from 'vscode';
import { IdentityMetadataClient } from '../dataverse/identityMetadataClient';
import { IdentityMutationClient } from '../dataverse/identityMutationClient';
import { DataverseConnection, getDataverseConnection } from '../dataverse/dataverseConnection';
import { createInitialIdentityManagerState, IdentityManagerState } from '../product/identityManagerState';
import { IdentityDefinitionDraft, ParticipationMode, PrincipalType } from '../product/identityManagerTypes';
import { validateDrafts } from '../product/identityManagerValidation';
import { buildIdentityManagerViewModel } from '../product/identityManagerViewModelBuilder';
import { renderIdentityManagerHtml } from '../webview/renderIdentityManagerHtml';

const panelTitle = 'DV Identity Manager';
const commandName = 'DV Identity Manager';


function buildFeedbackUrl(context: vscode.ExtensionContext): vscode.Uri {
	const packageJson = context.extension.packageJSON as { version?: string };
	const version = encodeURIComponent(packageJson.version ?? 'unknown');
	return vscode.Uri.parse(`https://dvforgelab.com/feedback?product=dvim&version=${version}`);
}

type WebviewMessage = {
	command?: string;
	payload?: Record<string, unknown>;
};


function classifyEnvironmentSafety(label: string, url?: string): { safety: 'Grey' | 'Amber' | 'Red'; safetyLabel: string } {
	const value = `${label} ${url ?? ''}`.toLowerCase();
	const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);
	const hasToken = (...matches: string[]) => matches.some(match => tokens.includes(match) || value.includes(match));

	if (hasToken('prod', 'production', 'live')) {
		return { safety: 'Red', safetyLabel: 'Production environment' };
	}

	if (hasToken('sit', 'uat', 'test', 'tst', 'qa', 'perf', 'preprod', 'pre', 'preproduction', 'staging', 'stage')) {
		return { safety: 'Amber', safetyLabel: 'Controlled non-production' };
	}

	return { safety: 'Grey', safetyLabel: 'Development / non-production' };
}

function createDraft(partial: Partial<IdentityDefinitionDraft> = {}): IdentityDefinitionDraft {
	return {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		principalType: (partial.principalType ?? 'User') as PrincipalType,
		identifier: String(partial.identifier ?? ''),
		displayName: partial.displayName ?? '',
		roles: partial.roles ?? '',
		teams: partial.teams ?? '',
		removeRoles: partial.removeRoles ?? '',
		removeTeams: partial.removeTeams ?? '',
		mode: (partial.mode ?? 'Additive') as ParticipationMode,
		description: partial.description ?? '',
		managedState: partial.managedState,
		managedSolutionName: partial.managedSolutionName,
		teamType: partial.teamType,
		teamTypeLabel: partial.teamTypeLabel,
		isAccessTeam: partial.isAccessTeam
	};
}

function normaliseString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function toCsvValue(value: unknown): string {
	const text = String(value ?? '');
	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

function normaliseParticipationList(value: string | undefined): string {
	return String(value ?? '')
		.split(/[;\n]/)
		.map(item => item.trim().toLowerCase())
		.filter(Boolean)
		.sort()
		.join(';');
}

function draftIdentityKey(draft: IdentityDefinitionDraft): string {
	return `${draft.principalType.trim().toLowerCase()}::${draft.identifier.trim().toLowerCase()}`;
}

function draftOperationKey(draft: IdentityDefinitionDraft): string {
	return [
		draftIdentityKey(draft),
		normaliseParticipationList(draft.roles),
		normaliseParticipationList(draft.teams),
		normaliseParticipationList(draft.removeRoles),
		normaliseParticipationList(draft.removeTeams),
		String(draft.mode ?? 'Additive').toLowerCase()
	].join('::');
}

function draftToCsvRow(draft: IdentityDefinitionDraft): string {
	return [
		draft.principalType,
		draft.identifier,
		draft.displayName ?? '',
		draft.roles ?? '',
		draft.teams ?? '',
		draft.removeRoles ?? '',
		draft.removeTeams ?? '',
		draft.mode,
		draft.description ?? ''
	].map(toCsvValue).join(',');
}

function buildCsvContent(drafts: IdentityDefinitionDraft[]): string {
	const header = 'PrincipalType,Identifier,DisplayName,AssignRoles,AddTeams,RemoveRoles,RemoveTeams,Mode,Description';
	if (!drafts.length) {
		return `${header}\nUser,user@contoso.com,Example User,"Salesperson;Customer Service Rep",Operations Team,,,Additive,Example user role and team participation\nTeam,Operations Team,Operations Team,Salesperson,,,,Additive,Example team role participation\nApplicationUser,00000000-0000-0000-0000-000000000000,Example App User,Integration Role,,,,Additive,Example application user role participation\n`;
	}
	return `${header}\n${drafts.map(draftToCsvRow).join('\n')}\n`;
}

function buildJsonContent(drafts: IdentityDefinitionDraft[]): string {
	const payload = drafts.length ? drafts : [
		createDraft({ principalType: 'User', identifier: 'user@contoso.com', displayName: 'Example User', roles: 'Salesperson;Customer Service Rep', teams: 'Operations Team', description: 'Example user role and team participation' }),
		createDraft({ principalType: 'Team', identifier: 'Operations Team', displayName: 'Operations Team', roles: 'Salesperson', description: 'Example team role participation' }),
		createDraft({ principalType: 'ApplicationUser', identifier: '00000000-0000-0000-0000-000000000000', displayName: 'Example App User', roles: 'Integration Role', description: 'Example application user role participation' })
	];
	return `${JSON.stringify({ version: '1.0', identities: payload.map(({ id: _id, ...draft }) => draft) }, null, 2)}\n`;
}

function normalisePrincipalType(value: string): PrincipalType {
	const cleaned = value.replace(/\s+/g, '').toLowerCase();
	if (cleaned === 'team') {
		return 'Team';
	}
	if (cleaned === 'applicationuser' || cleaned === 'appuser') {
		return 'ApplicationUser';
	}
	return 'User';
}

function normaliseMode(value: string): ParticipationMode {
	return value.toLowerCase() === 'exact' ? 'Exact' : 'Additive';
}

function importJson(content: string): IdentityDefinitionDraft[] {
	const parsed = JSON.parse(content) as unknown;
	const rows = Array.isArray(parsed)
		? parsed
		: parsed && typeof parsed === 'object' && Array.isArray((parsed as { identities?: unknown[] }).identities)
			? (parsed as { identities: unknown[] }).identities
			: [];
	return rows.map(row => {
		const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
		return createDraft({
			principalType: normalisePrincipalType(normaliseString(item.principalType)),
			identifier: normaliseString(item.identifier ?? item.upn ?? item.applicationId ?? item.teamName),
			displayName: normaliseString(item.displayName ?? item.name),
			roles: Array.isArray(item.roles) ? item.roles.map(String).join(';') : normaliseString(item.roles ?? item.assignRoles),
			teams: Array.isArray(item.teams) ? item.teams.map(String).join(';') : normaliseString(item.teams ?? item.addTeams),
			removeRoles: Array.isArray(item.removeRoles) ? item.removeRoles.map(String).join(';') : normaliseString(item.removeRoles),
			removeTeams: Array.isArray(item.removeTeams) ? item.removeTeams.map(String).join(';') : normaliseString(item.removeTeams),
			mode: normaliseMode(normaliseString(item.mode)),
			description: normaliseString(item.description)
		});
	});
}

function parseCsvRecords(content: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let current = '';
	let quoted = false;
	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];
		if (character === '"') {
			if (quoted && content[index + 1] === '"') {
				current += '"';
				index += 1;
			} else {
				quoted = !quoted;
			}
			continue;
		}
		if (character === ',' && !quoted) {
			record.push(current.trim());
			current = '';
			continue;
		}
		if ((character === '\n' || character === '\r') && !quoted) {
			if (character === '\r' && content[index + 1] === '\n') {
				index += 1;
			}
			record.push(current.trim());
			current = '';
			if (record.some(value => value.length > 0)) {
				records.push(record);
			}
			record = [];
			continue;
		}
		current += character;
	}
	record.push(current.trim());
	if (record.some(value => value.length > 0)) {
		records.push(record);
	}
	return records;
}

function importCsv(content: string): IdentityDefinitionDraft[] {
	const records = parseCsvRecords(content);
	if (records.length < 2) {
		return [];
	}
	const headers = records[0].map(header => header.toLowerCase().replace(/\s+/g, ''));
	return records.slice(1).map(values => {
		const row = new Map(headers.map((header, index) => [header, values[index] ?? '']));
		return createDraft({
			principalType: normalisePrincipalType(row.get('principaltype') ?? ''),
			identifier: row.get('identifier') ?? row.get('upn') ?? row.get('applicationid') ?? row.get('teamname') ?? '',
			displayName: row.get('displayname') ?? '',
			roles: row.get('roles') ?? row.get('assignroles') ?? '',
			teams: row.get('teams') ?? row.get('addteams') ?? '',
			removeRoles: row.get('removeroles') ?? '',
			removeTeams: row.get('removeteams') ?? '',
			mode: normaliseMode(row.get('mode') ?? ''),
			description: row.get('description') ?? ''
		});
	});
}

function hasParticipationOperation(draft: IdentityDefinitionDraft): boolean {
	return Boolean(
		normaliseParticipationList(draft.roles)
		|| normaliseParticipationList(draft.teams)
		|| normaliseParticipationList(draft.removeRoles)
		|| normaliseParticipationList(draft.removeTeams)
	);
}

function splitParticipationValues(value: string | undefined): string[] {
	return String(value ?? '')
		.split(/\r?\n|;/)
		.map(item => item.trim())
		.filter(Boolean);
}

function mergeParticipationValues(existing: string | undefined, incoming: string | undefined): { value: string; added: number; duplicates: number } {
	const values = splitParticipationValues(existing);
	const seen = new Set(values.map(item => item.toLowerCase()));
	let added = 0;
	let duplicates = 0;
	for (const item of splitParticipationValues(incoming)) {
		const key = item.toLowerCase();
		if (seen.has(key)) {
			duplicates += 1;
			continue;
		}
		values.push(item);
		seen.add(key);
		added += 1;
	}
	return { value: values.join('; '), added, duplicates };
}

function mergeDraftIntoTarget(target: IdentityDefinitionDraft, incoming: IdentityDefinitionDraft): { operationsAdded: number; duplicates: number } {
	let operationsAdded = 0;
	let duplicates = 0;
	const roles = mergeParticipationValues(target.roles, incoming.roles);
	target.roles = roles.value;
	operationsAdded += roles.added;
	duplicates += roles.duplicates;

	const teams = mergeParticipationValues(target.teams, incoming.teams);
	target.teams = teams.value;
	operationsAdded += teams.added;
	duplicates += teams.duplicates;

	const removeRoles = mergeParticipationValues(target.removeRoles, incoming.removeRoles);
	target.removeRoles = removeRoles.value;
	operationsAdded += removeRoles.added;
	duplicates += removeRoles.duplicates;

	const removeTeams = mergeParticipationValues(target.removeTeams, incoming.removeTeams);
	target.removeTeams = removeTeams.value;
	operationsAdded += removeTeams.added;
	duplicates += removeTeams.duplicates;

	if (!target.displayName && incoming.displayName) {
		target.displayName = incoming.displayName;
	}
	if (!target.description && incoming.description) {
		target.description = incoming.description;
	}
	return { operationsAdded, duplicates };
}

function addImportedDrafts(existing: IdentityDefinitionDraft[], imported: IdentityDefinitionDraft[]): { rowsStaged: number; definitionsCreated: number; definitionsMerged: number; duplicates: number; invalid: number; total: number } {
	let rowsStaged = 0;
	let definitionsCreated = 0;
	let definitionsMerged = 0;
	let duplicates = 0;
	let invalid = 0;
	for (const draft of imported) {
		if (!draft.identifier.trim() || !hasParticipationOperation(draft)) {
			invalid += 1;
			continue;
		}
		const key = `${draftIdentityKey(draft)}::${String(draft.mode ?? 'Additive').toLowerCase()}`;
		const target = existing.find(item => `${draftIdentityKey(item)}::${String(item.mode ?? 'Additive').toLowerCase()}` === key);
		if (target) {
			const result = mergeDraftIntoTarget(target, draft);
			if (result.operationsAdded > 0) {
				rowsStaged += 1;
				definitionsMerged += 1;
			} else {
				duplicates += Math.max(result.duplicates, 1);
			}
			continue;
		}
		existing.push(draft);
		rowsStaged += 1;
		definitionsCreated += 1;
	}
	return { rowsStaged, definitionsCreated, definitionsMerged, duplicates, invalid, total: imported.length };
}

function updateValidation(state: IdentityManagerState): void {
	const result = validateDrafts(state.drafts, state.roles, state.teams, state.identities);
	state.validationIssues = result.issues;
	state.pendingChanges = result.pendingChanges;
}

export async function openIdentityManagerCommand(context: vscode.ExtensionContext): Promise<void> {
	let connection: DataverseConnection | undefined;
	let metadataClient: IdentityMetadataClient | undefined;
	let mutationClient: IdentityMutationClient | undefined;
	const state = createInitialIdentityManagerState();

	const panel = vscode.window.createWebviewPanel('dvIdentityManager', panelTitle, vscode.ViewColumn.One, {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'images')]
	});
	const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'images', 'dv-utilities-icon-128.png'));

	function render(): void {
		panel.webview.html = renderIdentityManagerHtml(buildIdentityManagerViewModel(state), {
			logoUri: logoUri.toString(),
			cspSource: panel.webview.cspSource
		});
	}

	async function loadIdentityContext(): Promise<void> {
		if (!metadataClient) {
			return;
		}
		const [roles, teams, identities] = await Promise.all([
			metadataClient.listRoles(),
			metadataClient.listTeams(),
			metadataClient.listIdentities()
		]);
		state.roles = roles;
		state.teams = teams;
		state.identities = identities;
	}

	async function connect(forcePick = false): Promise<void> {
		try {
			state.message = { kind: 'Info', text: 'Connecting to Dataverse...' };
			render();
			connection = await getDataverseConnection(context, { forcePick });
			if (!connection) {
				state.message = { kind: 'Warning', text: 'Connection cancelled.' };
				render();
				return;
			}
			metadataClient = new IdentityMetadataClient(connection.client);
			mutationClient = new IdentityMutationClient(connection.client, metadataClient, connection.environmentUrl);
			const environmentSafety = classifyEnvironmentSafety(connection.environmentLabel, connection.environmentUrl);
			state.environment = {
				label: connection.environmentLabel,
				url: connection.environmentUrl,
				state: 'Connected',
				safety: environmentSafety.safety,
				safetyLabel: environmentSafety.safetyLabel
			};
			await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `${commandName}: Loading identity participation metadata`, cancellable: false }, loadIdentityContext);
			updateValidation(state);
			state.message = { kind: 'Info', text: `Connected to ${connection.environmentLabel}. ${state.identities.length} identity/identities, ${state.roles.length} role(s), and ${state.teams.length} team(s) loaded.` };
			render();
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) };
			render();
		}
	}

	async function importCsvFromFile(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { CSV: ['csv'] }, openLabel: 'Import CSV' });
		if (!picked?.[0]) {
			return;
		}
		const bytes = await vscode.workspace.fs.readFile(picked[0]);
		const imported = importCsv(Buffer.from(bytes).toString('utf8'));
		const result = addImportedDrafts(state.drafts, imported);
		state.executionResults = [];
		state.previewOpen = false;
		state.definitionMessage = undefined;
		updateValidation(state);
		state.message = undefined;
		state.definitionMessage = { kind: 'Info', text: `Imported ${result.total} CSV row(s): ${result.rowsStaged} staged into ${result.definitionsCreated + result.definitionsMerged} definition card(s), ${result.duplicates} duplicate operation(s) skipped, ${result.invalid} invalid row(s) skipped.` };
		render();
	}

	async function importJsonFromFile(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ['json'] }, openLabel: 'Import JSON' });
		if (!picked?.[0]) {
			return;
		}
		const bytes = await vscode.workspace.fs.readFile(picked[0]);
		const imported = importJson(Buffer.from(bytes).toString('utf8'));
		const result = addImportedDrafts(state.drafts, imported);
		state.executionResults = [];
		state.previewOpen = false;
		updateValidation(state);
		state.message = undefined;
		state.definitionMessage = { kind: 'Info', text: `Imported ${result.total} JSON row(s): ${result.rowsStaged} staged into ${result.definitionsCreated + result.definitionsMerged} definition card(s), ${result.duplicates} duplicate operation(s) skipped, ${result.invalid} invalid row(s) skipped.` };
		render();
	}

	async function exportJson(): Promise<void> {
		const hasDrafts = state.drafts.length > 0;
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(hasDrafts ? 'dv-identity-manager-definitions.json' : 'dv-identity-manager-template.json'),
			filters: { JSON: ['json'] },
			saveLabel: hasDrafts ? 'Export Definitions' : 'Save Template'
		});
		if (!uri) {
			return;
		}
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildJsonContent(state.drafts), 'utf8'));
		state.message = { kind: 'Info', text: hasDrafts ? `${state.drafts.length} staged definition(s) exported to JSON.` : 'JSON template exported.' };
		render();
	}

	async function exportCsv(): Promise<void> {
		const hasDrafts = state.drafts.length > 0;
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(hasDrafts ? 'dv-identity-manager-definitions.csv' : 'dv-identity-manager-template.csv'),
			filters: { CSV: ['csv'] },
			saveLabel: hasDrafts ? 'Export Definitions' : 'Save Template'
		});
		if (!uri) {
			return;
		}
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildCsvContent(state.drafts), 'utf8'));
		state.message = { kind: 'Info', text: hasDrafts ? `${state.drafts.length} staged definition(s) exported to CSV.` : 'CSV template exported.' };
		render();
	}


	async function manageIdentity(identityId: string): Promise<void> {
		if (!metadataClient) {
			state.message = { kind: 'Warning', text: 'Connect to Dataverse before loading identity participation.' };
			render();
			return;
		}
		const identity = state.identities.find(item => item.id === identityId);
		if (!identity) {
			state.message = { kind: 'Warning', text: 'Selected identity was not found in the loaded identity list.' };
			render();
			return;
		}
		state.selectedParticipation = { identity, roles: [], teams: [] };
		state.message = { kind: 'Info', text: `Loading participation for ${identity.displayName ?? identity.identifier}...` };
		render();
		try {
			state.selectedParticipation = await metadataClient.getParticipation(identity);
			const enrichedIdentity = state.selectedParticipation.identity;
			state.identities = state.identities.map(item => item.id === enrichedIdentity.id ? { ...item, ...enrichedIdentity } : item);
			updateValidation(state);
			state.message = { kind: 'Info', text: `Loaded participation for ${identity.displayName ?? identity.identifier}.` };
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? `Could not load participation for ${identity.displayName ?? identity.identifier}: ${error.message}` : `Could not load participation for ${identity.displayName ?? identity.identifier}: ${String(error)}` };
		}
		render();
	}

	function appendListValue(existing: string | undefined, value: string): string {
		const values = (existing ?? '').split(/\r?\n|;/).map(item => item.trim()).filter(Boolean);
		if (!values.some(item => item.toLowerCase() === value.toLowerCase())) {
			values.push(value);
		}
		return values.join('; ');
	}

	function createDraftForSelected(kind: string, targetName: string): void {
		const selected = state.selectedParticipation?.identity;
		if (!selected) {
			state.message = { kind: 'Warning', text: 'Select an identity before staging participation changes.' };
			return;
		}
		const draft = createDraft({
			principalType: selected.principalType,
			identifier: selected.identifier,
			displayName: selected.displayName ?? selected.identifier,
			description: 'Staged from Identity Browser',
			managedState: selected.managedState,
			managedSolutionName: selected.managedSolutionName,
			teamType: selected.teamType,
			teamTypeLabel: selected.teamTypeLabel,
			isAccessTeam: selected.isAccessTeam
		});
		if (kind === 'AssignRole') {
			draft.roles = appendListValue(draft.roles, targetName);
		} else if (kind === 'RemoveRole') {
			draft.removeRoles = appendListValue(draft.removeRoles, targetName);
		} else if (kind === 'AddTeamMembership') {
			draft.teams = appendListValue(draft.teams, targetName);
		} else if (kind === 'RemoveTeamMembership') {
			draft.removeTeams = appendListValue(draft.removeTeams, targetName);
		}
		const result = addImportedDrafts(state.drafts, [draft]);
		state.executionResults = [];
		state.previewOpen = false;
		updateValidation(state);
		const actionLabel = kind === 'AssignRole' ? 'role assignment' : kind === 'RemoveRole' ? 'role removal' : kind === 'AddTeamMembership' ? 'team membership add' : 'team membership removal';
		state.message = { kind: result.rowsStaged ? 'Info' : 'Warning', text: result.rowsStaged ? `Staged ${actionLabel}: ${selected.displayName ?? selected.identifier} → ${targetName}. Merged into the identity definition card below; Preview before applying.` : `Duplicate ${actionLabel} ignored: ${selected.displayName ?? selected.identifier} → ${targetName}.` };
		state.definitionMessage = { kind: result.rowsStaged ? 'Info' : 'Warning', text: result.rowsStaged ? `Staged ${actionLabel} from Identity Browser. Existing definition cards for the same identity are merged automatically.` : `Duplicate staged operation skipped.` };
	}

	async function applyChanges(): Promise<void> {
		if (!mutationClient) {
			state.message = { kind: 'Warning', text: 'Connect to Dataverse before applying changes.' };
			render();
			return;
		}
		updateValidation(state);
		if (state.validationIssues.some(issue => issue.severity === 'Error')) {
			state.message = { kind: 'Error', text: 'Resolve validation errors before applying changes.' };
			render();
			return;
		}
		const confirmed = await vscode.window.showWarningMessage(
			`Apply ${state.pendingChanges.length} staged identity participation change(s) to ${state.environment.label}?`,
			{ modal: true },
			'Apply Changes'
		);
		if (confirmed !== 'Apply Changes') {
			return;
		}
		state.message = { kind: 'Info', text: 'Applying identity participation changes...' };
		render();
		state.executionResults = await mutationClient.applyChanges(state.pendingChanges);
		state.previewOpen = false;

		const appliedCount = state.executionResults.filter(item => item.status === 'Applied').length;
		const failedCount = state.executionResults.filter(item => item.status === 'Failed').length;
		const skippedCount = state.executionResults.filter(item => item.status === 'Skipped').length;

		const resultIdsByDraft = new Map<string, Array<'Applied' | 'Skipped' | 'Failed'>>();
		for (const result of state.executionResults) {
			const statuses = resultIdsByDraft.get(result.draftId) ?? [];
			statuses.push(result.status);
			resultIdsByDraft.set(result.draftId, statuses);
		}

		const draftsToKeep = new Set<string>();
		for (const [draftId, statuses] of resultIdsByDraft.entries()) {
			if (statuses.some(status => status === 'Failed')) {
				draftsToKeep.add(draftId);
			}
		}
		state.drafts = state.drafts.filter(draft => draftsToKeep.has(draft.id));

		if (metadataClient && state.selectedParticipation?.identity) {
			try {
				state.selectedParticipation = await metadataClient.getParticipation(state.selectedParticipation.identity);
				const refreshedIdentity = state.selectedParticipation.identity;
				state.identities = state.identities.map(item => item.id === refreshedIdentity.id ? { ...item, ...refreshedIdentity } : item);
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				state.message = { kind: 'Warning', text: `${appliedCount} participation change(s) applied. ${failedCount} failed. Current participation could not be refreshed: ${detail}` };
				updateValidation(state);
				render();
				return;
			}
		}

		updateValidation(state);
		const stagingMessage = state.drafts.length
			? `${state.drafts.length} failed/still-reviewable staged definition row(s) retained.`
			: 'Definition staging cleared.';
		state.message = { kind: failedCount ? 'Warning' : 'Info', text: `${appliedCount} participation change(s) applied. ${skippedCount} skipped. ${failedCount} failed. ${stagingMessage} Current participation refreshed.` };
		render();
	}

	panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
		try {
			switch (message.command) {
				case 'connect':
					await connect(false);
					break;
				case 'switchEnvironment':
					await connect(true);
					break;
				case 'updateIdentitySearch':
					state.identitySearchQuery = normaliseString(message.payload?.value);
					render();
					break;
				case 'manageIdentity':
					await manageIdentity(normaliseString(message.payload?.id));
					break;
				case 'stageParticipation':
					createDraftForSelected(normaliseString(message.payload?.kind), normaliseString(message.payload?.targetName));
					render();
					break;
				case 'addDraft':
					state.drafts.push(createDraft({ description: 'Manual participation definition' }));
					state.executionResults = [];
					updateValidation(state);
					render();
					break;
				case 'updateDraft': {
					const id = normaliseString(message.payload?.id);
					const field = normaliseString(message.payload?.field) as keyof IdentityDefinitionDraft;
					const draft = state.drafts.find(item => item.id === id);
					if (draft && field) {
						const rawValue = String(message.payload?.value ?? '');
						if (field === 'principalType') {
							draft.principalType = normalisePrincipalType(rawValue);
						} else if (field === 'mode') {
							draft.mode = normaliseMode(rawValue);
						} else {
							(draft[field] as string | undefined) = rawValue;
						}
						state.executionResults = [];
						updateValidation(state);
						render();
					}
					break;
				}
				case 'removeDraft':
					state.drafts = state.drafts.filter(draft => draft.id !== normaliseString(message.payload?.id));
					state.executionResults = [];
					updateValidation(state);
					render();
					break;
				case 'importCsv':
					await importCsvFromFile();
					break;
				case 'importJson':
					await importJsonFromFile();
					break;
				case 'exportCsv':
					await exportCsv();
					break;
				case 'exportJson':
					await exportJson();
					break;
				case 'validate':
					if (metadataClient) {
						await loadIdentityContext();
					}
					updateValidation(state);
					state.message = { kind: state.validationIssues.some(issue => issue.severity === 'Error') ? 'Error' : 'Info', text: `${state.validationIssues.length} validation issue(s) found.` };
					render();
					break;
				case 'openPreview':
					updateValidation(state);
					state.previewOpen = true;
					render();
					break;
				case 'cancelPreview':
					state.previewOpen = false;
					render();
					break;
				case 'applyChanges':
					await applyChanges();
					break;
				case 'clearDrafts':
					state.drafts = [];
					state.executionResults = [];
					state.previewOpen = false;
					updateValidation(state);
					render();
					break;
				case 'openFeedback':
					await vscode.env.openExternal(buildFeedbackUrl(context));
					break;
			}
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) };
			render();
		}
	});

	state.message = { kind: 'Info', text: 'Connect to Dataverse to load identity participation metadata. No connection is made until you click Connect.' };
	render();
}
