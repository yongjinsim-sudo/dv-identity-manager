import { escapeHtml } from '../shared/escaping';
import { IdentityDefinitionDraft, IdentityManagerViewModel, ParticipationMode, ParticipationOperationKind, PrincipalType, RoleSummary, TeamSummary } from '../product/identityManagerTypes';
import { identityManagerScript } from './identityManagerScript';
import { identityManagerStyles } from './identityManagerStyles';

type RenderOptions = { logoUri: string; cspSource: string };

const principalTypes: PrincipalType[] = ['User', 'Team', 'ApplicationUser'];
const participationModes: ParticipationMode[] = ['Additive', 'Exact'];

function input(draft: IdentityDefinitionDraft, field: keyof IdentityDefinitionDraft, value: unknown, extra = ''): string {
	return `<input ${extra} value="${escapeHtml(String(value ?? ''))}" data-command="updateDraft" data-id="${escapeHtml(draft.id)}" data-field="${escapeHtml(String(field))}">`;
}

function textarea(draft: IdentityDefinitionDraft, field: keyof IdentityDefinitionDraft, value: unknown, placeholder = ''): string {
	return `<textarea class="dv-description" placeholder="${escapeHtml(placeholder)}" data-command="updateDraft" data-id="${escapeHtml(draft.id)}" data-field="${escapeHtml(String(field))}">${escapeHtml(String(value ?? ''))}</textarea>`;
}

function getPrincipalTypeLabel(value: PrincipalType): string {
	return value === 'ApplicationUser' ? 'Application User' : value;
}

function select(draft: IdentityDefinitionDraft, field: keyof IdentityDefinitionDraft, values: string[], selected: string): string {
	return `<select data-command="updateDraft" data-id="${escapeHtml(draft.id)}" data-field="${escapeHtml(String(field))}">${values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value === 'ApplicationUser' ? 'Application User' : value)}</option>`).join('')}</select>`;
}

function getEnvironmentPillClass(viewModel: IdentityManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning'; }
	if (viewModel.environment.safety === 'Grey') { return 'grey'; }
	return 'accent';
}

function getApplyButtonClass(viewModel: IdentityManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-primary'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-primary'; }
	return 'primary';
}

function getPreviewCardClass(viewModel: IdentityManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-preview'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-preview'; }
	return 'grey-preview';
}

function getApplyWarningText(viewModel: IdentityManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') {
		return 'Production-class environment detected. Review identity participation changes carefully before applying.';
	}
	if (viewModel.environment.safety === 'Amber') {
		return 'Controlled non-production environment detected. Review staged participation changes before applying.';
	}
	return 'These changes are staged locally. Dataverse identity participation is only changed when you choose Apply.';
}

function countList(value: string | undefined): number {
	return (value ?? '').split(/\r?\n|;/).map(item => item.trim()).filter(Boolean).length;
}


function getManagedPillHtml(managedState: string | undefined, managedSolutionName?: string): string {
	if (managedState === 'Managed') {
		return `<span class="dv-pill warning">Managed component${managedSolutionName ? ` • ${escapeHtml(managedSolutionName)}` : ''}</span>`;
	}
	if (managedState === 'Unmanaged') {
		return '<span class="dv-pill success">Unmanaged</span>';
	}
	if (managedState === 'Unknown') {
		return '<span class="dv-pill warning">Managed metadata not confirmed</span>';
	}
	return '';
}

function getManagedStatusNote(managedState: string | undefined, managedReason?: string): string {
	if (managedState === 'Managed') {
		return `Dataverse solution metadata indicates this application user is managed. Some role changes may be blocked by Dataverse, while some membership changes may still be permitted. DVIM will surface the platform response and will not bypass protection.${managedReason ? ` ${escapeHtml(managedReason)}` : ''}`;
	}
	if (managedState === 'Unmanaged') {
		return `Dataverse solution metadata did not mark this identity as managed.${managedReason ? ` ${escapeHtml(managedReason)}` : ''}`;
	}
	return `DVIM could not confirm managed/unmanaged state from solution metadata. Dataverse may still block some role operations at apply time, especially for first-party application users.${managedReason ? ` ${escapeHtml(managedReason)}` : ''}`;
}

function formatDraftSummary(draft: IdentityDefinitionDraft): string {
	const assignRoleCount = countList(draft.roles);
	const addTeamCount = countList(draft.teams);
	const removeRoleCount = countList(draft.removeRoles);
	const removeTeamCount = countList(draft.removeTeams);
	const parts = [];
	if (assignRoleCount) { parts.push(`${assignRoleCount} role assign${assignRoleCount === 1 ? '' : 's'}`); }
	if (removeRoleCount) { parts.push(`${removeRoleCount} role removal${removeRoleCount === 1 ? '' : 's'}`); }
	if (addTeamCount) { parts.push(`${addTeamCount} team add${addTeamCount === 1 ? '' : 's'}`); }
	if (removeTeamCount) { parts.push(`${removeTeamCount} team removal${removeTeamCount === 1 ? '' : 's'}`); }
	return parts.length ? parts.join(' • ') : 'No participation entries';
}

function renderDraftRow(draft: IdentityDefinitionDraft, viewModel: IdentityManagerViewModel): string {
	const issues = viewModel.validationIssues.filter(issue => issue.draftId === draft.id);
	const managedPill = getManagedPillHtml(draft.managedState, draft.managedSolutionName);
	const issueHtml = issues.length
		? `<div class="dv-draft-issues">${issues.map(issue => `<span class="dv-pill ${issue.severity === 'Error' ? 'danger' : 'warning'}">${escapeHtml(issue.message)}</span>`).join('')}</div>`
		: managedPill || '<span class="dv-pill success">Valid</span>';
	const teamFields = draft.principalType !== 'Team'
		? `<label><span>Add to teams</span>${textarea(draft, 'teams', draft.teams ?? '', 'Operations Team; Support Team')}<em>User/Application User team memberships only.</em></label><label><span>Remove from teams</span>${textarea(draft, 'removeTeams', draft.removeTeams ?? '', 'Legacy Team')}<em>Stage team membership removals.</em></label>`
		: `<label><span>Teams</span><textarea disabled class="dv-description">Team-to-team membership is unsupported.</textarea><em>Team rows support role assignment only.</em></label>`;
	return `<div class="dv-draft-card">
		<div class="dv-draft-card-header">
			<div><strong>${escapeHtml(getPrincipalTypeLabel(draft.principalType))}: ${escapeHtml(draft.identifier || 'new.identity@contoso.com')}</strong><p>${escapeHtml(draft.displayName || 'Identity participation')} • ${escapeHtml(formatDraftSummary(draft))}</p></div>
			<div class="dv-draft-status">${issueHtml}<button class="secondary" data-command="removeDraft" data-id="${escapeHtml(draft.id)}">Remove</button></div>
		</div>
		<div class="dv-draft-fields">
			<label><span>Principal type</span>${select(draft, 'principalType', principalTypes, draft.principalType)}</label>
			<label><span>Identifier</span>${input(draft, 'identifier', draft.identifier, 'list="dvim-identities" placeholder="user@contoso.com / app id / team name"')}</label>
			<label><span>Display name</span>${input(draft, 'displayName', draft.displayName ?? '', 'placeholder="Optional display label"')}</label>
			<label><span>Mode</span>${select(draft, 'mode', participationModes, draft.mode)}<em>Additive applies listed participation only. Exact mode is reserved for future drift alignment.</em></label>
			<label><span>Assign roles</span>${textarea(draft, 'roles', draft.roles ?? '', 'Salesperson; Customer Service Rep')}<em>Use semicolon or new line separated role names.</em></label>
			<label><span>Remove roles</span>${textarea(draft, 'removeRoles', draft.removeRoles ?? '', 'Legacy Role')}<em>Stage role removals.</em></label>
			${teamFields}
			<label class="span-2"><span>Description</span>${textarea(draft, 'description', draft.description ?? '', 'Optional notes for this identity definition.')}</label>
		</div>
	</div>`;
}

function operationLabel(kind: ParticipationOperationKind): string {
	if (kind === 'AssignRole') { return 'Assign role'; }
	if (kind === 'RemoveRole') { return 'Remove role'; }
	if (kind === 'AddTeamMembership') { return 'Add team membership'; }
	return 'Remove team membership';
}

function renderPreview(viewModel: IdentityManagerViewModel): string {
	if (!viewModel.previewOpen) { return ''; }
	const hasErrors = viewModel.summary.errorCount > 0;
	return `<section class="dv-card dv-section dv-preview-card ${getPreviewCardClass(viewModel)}">
		<div class="dv-section-header">
			<div><div class="dv-kicker">Identity participation preview</div><h2>Preview participation changes</h2><p>Review staged identity participation before applying changes to Dataverse.</p></div>
			<span class="dv-pill warning">Preview-first</span>
		</div>
		<div class="dv-preview-grid">
			<div><span>Environment</span><strong>${escapeHtml(viewModel.environment.label)}</strong><em>${escapeHtml(viewModel.environment.safetyLabel)}</em></div>
			<div><span>Pending changes</span><strong>${escapeHtml(viewModel.pendingChanges.length)}</strong><em>${escapeHtml(viewModel.summary.errorCount)} error(s), ${escapeHtml(viewModel.summary.warningCount)} warning(s)</em></div>
			<div><span>Mutation</span><strong>Identity Participation</strong><em>No authority or privilege calculation.</em></div>
		</div>
		<div class="dv-list">
			${viewModel.pendingChanges.map(change => `<div class="dv-operation"><div><strong>${escapeHtml(change.draft.identifier)} → ${escapeHtml(change.targetName)}</strong><p>${escapeHtml(operationLabel(change.kind))} • ${escapeHtml(getPrincipalTypeLabel(change.draft.principalType))}</p></div><span class="dv-pill ${change.issues.some(issue => issue.severity === 'Error') ? 'danger' : change.issues.length ? 'warning' : 'success'}">${change.issues.length ? `${change.issues.length} issue(s)` : 'Ready'}</span></div>`).join('') || '<div class="dv-empty">No staged participation changes.</div>'}
		</div>
		<div class="dv-preview-note">${escapeHtml(getApplyWarningText(viewModel))}</div>
		<div class="dv-actions" style="margin-top:12px">
			<button class="secondary" data-command="cancelPreview">Cancel preview</button>
			<button class="${getApplyButtonClass(viewModel)}" ${hasErrors || !viewModel.pendingChanges.length ? 'disabled' : ''} data-command="applyChanges">Apply ${escapeHtml(viewModel.pendingChanges.length)} Participation Changes</button>
		</div>
	</section>`;
}

function renderResults(viewModel: IdentityManagerViewModel): string {
	if (!viewModel.executionResults.length) { return ''; }
	return `<section class="dv-card dv-section"><h2>Execution results</h2><div class="dv-list">${viewModel.executionResults.map(result => `<div class="dv-result"><div><strong>${escapeHtml(result.targetName)}</strong><p>${escapeHtml(result.message)}</p></div><span class="dv-pill ${result.status === 'Applied' ? 'success' : result.status === 'Failed' ? 'danger' : 'warning'}">${escapeHtml(result.status)}</span></div>`).join('')}</div></section>`;
}

function isSameName(left: string, right: string): boolean {
	return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function renderIdentityBrowser(viewModel: IdentityManagerViewModel): string {
	const results = viewModel.identities;
	return `<section class="dv-card dv-section dv-browser-section">
		<div class="dv-section-header"><div><h2>Identity Browser</h2><p>Search users, teams, and application users. Click <strong>Manage</strong>, then use <strong>Add</strong> or <strong>Remove</strong> beside roles and teams to stage participation changes.</p></div></div>
		<div class="dv-browser-search"><input value="" placeholder="Search users, teams, or application users..." data-local-filter="#dvim-identity-results"><button class="secondary" data-command="validate">Refresh</button></div>
		<div id="dvim-identity-results" class="dv-browser-results">${results.length ? results.map(identity => { const filterText = [identity.identifier, identity.displayName, identity.businessUnitName, identity.principalType].filter(Boolean).join(' '); return `<div class="dv-identity-result" data-filter-text="${escapeHtml(filterText)}"><div><strong>${escapeHtml(identity.displayName ?? identity.identifier)}</strong><p>${escapeHtml(getPrincipalTypeLabel(identity.principalType))} • ${escapeHtml(identity.identifier)}${identity.businessUnitName ? ` • ${escapeHtml(identity.businessUnitName)}` : ''}${identity.isAccessTeam ? ' • Access Team' : identity.teamTypeLabel ? ` • ${escapeHtml(identity.teamTypeLabel)}` : ''}</p></div><button data-command="manageIdentity" data-id="${escapeHtml(identity.id)}">Manage</button></div>`; }).join('') : '<div class="dv-empty">No matching identities loaded. Connect or adjust your search.</div>'}</div>
	</section>`;
}

function renderParticipationList(title: string, items: Array<RoleSummary | TeamSummary>, empty: string, removeKind?: ParticipationOperationKind, canMutate = true): string {
	return `<div class="dv-participation-box"><h3>${escapeHtml(title)}</h3>${items.length ? `<div class="dv-chip-list">${items.map(item => `<span class="dv-participation-chip"><span>${escapeHtml('name' in item ? item.name : '')}</span>${removeKind ? `<button class="secondary tiny" ${canMutate ? '' : 'disabled title="Managed identity mutations are blocked"'} data-command="stageParticipation" data-kind="${removeKind}" data-target-name="${escapeHtml('name' in item ? item.name : '')}">Remove</button>` : ''}</span>`).join('')}</div>` : `<p class="dv-muted">${escapeHtml(empty)}</p>`}</div>`;
}

function renderAvailableList(title: string, allItems: Array<RoleSummary | TeamSummary>, currentNames: string[], addKind: ParticipationOperationKind, listId: string, canMutate = true): string {
	const available = allItems.filter(item => !currentNames.some(name => isSameName(name, item.name)));
	const helper = addKind === 'AssignRole' ? 'Click Add to stage a role assignment. Nothing changes until Preview and Apply.' : 'Click Add to stage a team membership. Nothing changes until Preview and Apply.';
	return `<div class="dv-participation-box"><h3>${escapeHtml(title)}</h3><p class="dv-box-helper">${escapeHtml(helper)}</p>${available.length ? `<input class="dv-local-list-search" value="" placeholder="Search ${escapeHtml(title.toLowerCase())}..." data-local-filter="#${escapeHtml(listId)}"><div id="${escapeHtml(listId)}" class="dv-chip-list dv-scroll-chip-list">${available.map(item => `<span class="dv-participation-chip" data-filter-text="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><button class="secondary tiny" ${canMutate ? '' : 'disabled title="Managed identity mutations are blocked"'} data-command="stageParticipation" data-kind="${addKind}" data-target-name="${escapeHtml(item.name)}">Add</button></span>`).join('')}</div>` : '<p class="dv-muted">No available entries found.</p>'}</div>`;
}

function renderCurrentParticipation(viewModel: IdentityManagerViewModel): string {
	const snapshot = viewModel.selectedParticipation;
	if (!snapshot) { return ''; }
	const currentRoleNames = snapshot.roles.map(role => role.name);
	const currentTeamNames = snapshot.teams.map(team => team.name);
	const canMutate = true;
	const managedPill = getManagedPillHtml(snapshot.identity.managedState, snapshot.identity.managedSolutionName);
	return `<section class="dv-card dv-section">
		<div class="dv-section-header"><div><h2>Current participation</h2><p><strong>${escapeHtml(snapshot.identity.displayName ?? snapshot.identity.identifier)}</strong> • ${escapeHtml(getPrincipalTypeLabel(snapshot.identity.principalType))} • ${escapeHtml(snapshot.identity.identifier)}</p></div><div class="dv-status-stack"><span class="dv-pill success">Loaded</span>${managedPill}${snapshot.identity.isAccessTeam ? '<span class="dv-pill warning">Access Team</span>' : ''}</div></div>
		${snapshot.identity.principalType === 'ApplicationUser' ? `<div class="dv-managed-note">${getManagedStatusNote(snapshot.identity.managedState, snapshot.identity.managedReason)}</div>` : ''}${snapshot.identity.isAccessTeam ? '<div class="dv-managed-note">Access team detected. Dataverse may allow membership operations but reject role assignment or removal for this team type.</div>' : ''}
		<div class="dv-participation-grid">
			${renderParticipationList('Current roles', snapshot.roles, 'No roles found.', 'RemoveRole', canMutate)}
			${snapshot.identity.principalType !== 'Team' ? renderParticipationList('Current teams', snapshot.teams, 'No team memberships found.', 'RemoveTeamMembership', canMutate) : '<div class="dv-participation-box"><h3>Current teams</h3><p class="dv-muted">Team-to-team membership is unsupported.</p></div>'}
			${renderAvailableList('Available roles', viewModel.roles, currentRoleNames, 'AssignRole', 'dvim-available-roles', canMutate)}
			${snapshot.identity.principalType !== 'Team' ? renderAvailableList('Available teams', viewModel.teams, currentTeamNames, 'AddTeamMembership', 'dvim-available-teams', canMutate) : '<div class="dv-participation-box"><h3>Available teams</h3><p class="dv-muted">Team rows support role participation only.</p></div>'}
		</div>
	</section>`;
}

function renderDefinitions(viewModel: IdentityManagerViewModel): string {
	const definitionMessageHtml = viewModel.definitionMessage ? `<div class="dv-message local ${escapeHtml(viewModel.definitionMessage.kind)}">${escapeHtml(viewModel.definitionMessage.text)}</div>` : '';
	return `<section class="dv-card dv-section">
		<div class="dv-section-header"><div><h2>Definition staging</h2><p>Review participation changes staged from the Identity Browser, or import CSV / JSON participation definitions generated elsewhere. Staged rows stay local until Validate, Preview, and explicit Apply.</p></div><div class="dv-actions"><button data-command="addDraft">+ Manual definition</button><select class="dv-command-select" data-command-select="import"><option value="">Import...</option><option value="importCsv">CSV</option><option value="importJson">JSON</option></select><select class="dv-command-select" data-command-select="export"><option value="">Export...</option><option value="exportCsv">CSV</option><option value="exportJson">JSON</option></select><button class="secondary" data-command="validate">Validate</button><button class="secondary" data-command="clearDrafts">Clear</button><button ${viewModel.drafts.length ? '' : 'disabled'} data-command="openPreview">Preview</button></div></div>
		${definitionMessageHtml}
		<div class="dv-guidance-grid">
			<div class="dv-guidance-card"><strong>What is staged?</strong><p>Each row represents identity participation to add or remove for one user, team, or application user. Rows may come from the browser buttons, CSV import, JSON import, or advanced manual entry.</p></div>
			<div class="dv-guidance-card"><strong>What is not staged?</strong><p>DVIM does not edit privileges, create roles, calculate effective access, or manage business units. It only stages role assignments and team memberships.</p></div>
		</div>
		<details class="dv-field-guide"><summary>Definition field guide</summary>
			<div class="dv-field-guide-grid">
				<div><strong>Principal type</strong><span>User, Team, or Application User.</span></div>
				<div><strong>Identifier</strong><span>UPN/email for users, application id/name for app users, or team name for teams.</span></div>
				<div><strong>Assign roles</strong><span>Semicolon or newline separated role names to assign. Browser Add buttons fill this automatically.</span></div>
				<div><strong>Remove roles</strong><span>Semicolon or newline separated role names to remove. Current role Remove buttons fill this automatically.</span></div>
				<div><strong>Add to teams</strong><span>Team memberships to add. Available team Add buttons fill this automatically.</span></div>
				<div><strong>Remove from teams</strong><span>Team memberships to remove. Current team Remove buttons fill this automatically.</span></div>
				<div><strong>Mode</strong><span>Additive applies only listed changes. Exact is reserved for future DVQR drift alignment.</span></div>
				<div><strong>Description</strong><span>Optional note, source, or reason for the staged participation definition.</span></div>
			</div>
		</details>
		<datalist id="dvim-identities">${viewModel.identities.map(identity => `<option value="${escapeHtml(identity.identifier)}">${escapeHtml(`${getPrincipalTypeLabel(identity.principalType)} • ${identity.displayName ?? identity.identifier}`)}</option>`).join('')}</datalist>
		<div class="dv-draft-list">${viewModel.drafts.length ? viewModel.drafts.map(draft => renderDraftRow(draft, viewModel)).join('') : '<div class="dv-empty">Search an identity above and click Add/Remove to stage changes, or import a CSV / JSON participation definition.</div>'}</div>
		<div class="dv-bottom-actions"><button data-command="addDraft">+ Manual definition</button></div>
	</section>`;
}

export function renderIdentityManagerHtml(viewModel: IdentityManagerViewModel, options: RenderOptions): string {
	const messageHtml = viewModel.message ? `<div class="dv-message ${escapeHtml(viewModel.message.kind)}">${escapeHtml(viewModel.message.text)}</div>` : '';
	const environmentPillClass = getEnvironmentPillClass(viewModel);
	const environmentPillText = viewModel.environment.label === 'Not connected' ? 'No environment connected' : viewModel.environment.label;
	return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${options.cspSource}; style-src ${options.cspSource} 'unsafe-inline'; script-src ${options.cspSource} 'unsafe-inline';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${identityManagerStyles}</style><title>${escapeHtml(viewModel.productName)}</title></head>
	<body><div class="dv-shell">
		<header class="dv-hero"><div><div class="dv-kicker">DV FORGELAB UTILITY</div><h1>${escapeHtml(viewModel.productName)}</h1><p>${escapeHtml(viewModel.subtitle)}</p></div><div class="dv-logo-card"><img src="${options.logoUri}" alt="DV ForgeLab"></div></header>
		<section class="dv-toolbar" aria-label="Environment and actions"><div class="dv-status-pills"><span class="dv-pill ${environmentPillClass}">${escapeHtml(environmentPillText)}</span><span class="dv-pill">Preview-first</span><span class="dv-pill">Identity</span></div><div class="dv-actions"><button data-command="connect">Connect</button><button class="secondary" data-command="switchEnvironment">Change environment</button><button class="secondary" data-command="validate">Refresh</button></div></section>
		${messageHtml}
		<section class="dv-grid"><div class="dv-card dv-summary accent-blue"><span>IDENTITIES</span><strong>${escapeHtml(viewModel.summary.identityCount)}</strong><p>Loaded users, teams and app users</p></div><div class="dv-card dv-summary"><span>ROLES</span><strong>${escapeHtml(viewModel.summary.roleCount)}</strong><p>Loaded security roles</p></div><div class="dv-card dv-summary accent-yellow"><span>TEAMS</span><strong>${escapeHtml(viewModel.summary.teamCount)}</strong><p>Loaded teams</p></div><div class="dv-card dv-summary"><span>PENDING</span><strong>${escapeHtml(viewModel.summary.pendingChangeCount)}</strong><p>Before explicit apply</p></div></section>
		${renderIdentityBrowser(viewModel)}
		${renderCurrentParticipation(viewModel)}
		${renderDefinitions(viewModel)}
		${renderPreview(viewModel)}
		${renderResults(viewModel)}
		<section class="dv-card dv-section"><h2>Boundary</h2><p>Identity participation, not security analysis. DV Identity Manager manages assignments and memberships. It does not edit privileges, calculate effective access, simulate RBAC, or determine security authority.</p></section>
		<footer class="dv-footer-note">DV Identity Manager is a DV ForgeLab utility. <a href="https://marketplace.visualstudio.com/items?itemName=dv-forgelab.dv-quick-run">DV Quick Run</a> remains the flagship Dataverse investigation workbench.</footer>
	</div><script>${identityManagerScript}</script></body></html>`;
}
