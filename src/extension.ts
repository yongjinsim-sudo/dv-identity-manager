import * as vscode from 'vscode';
import { openIdentityManagerCommand } from './commands/openIdentityManagerCommand';

const openCommandId = 'dvIdentityManager.openIdentityManager';
const legacyOpenCommandId = 'dvIdentityManager.open';

export function activate(context: vscode.ExtensionContext) {
	const open = () => openIdentityManagerCommand(context);
	context.subscriptions.push(
		vscode.commands.registerCommand(openCommandId, open),
		vscode.commands.registerCommand(legacyOpenCommandId, open)
	);
}

export function deactivate() {}
