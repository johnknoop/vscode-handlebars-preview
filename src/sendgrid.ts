import * as vscode from 'vscode';
import * as path from 'path';
import * as mail from '@sendgrid/mail';
import { commands, window, workspace } from 'vscode';
import { HbsTreeItem } from './context-data-tree-provider';
import { getCompiledHtml } from './merger';
import { globals } from './globals';

export function onActivation(context: vscode.ExtensionContext) {
	commands.registerCommand(globals.CmdSendEmail, onSendEmail);
}

async function onSendEmail(item: HbsTreeItem) {
	if (!globals.currentEditor) {
		window.showErrorMessage("No Handlebars-file open");
		return;
	}
	const cfg = vscode.workspace.getConfiguration(globals.extensionKey);
	if (!cfg.has(globals.CfgSendGridApiKey)) {
		window.showErrorMessage("No SendGrid API key provided");
		return;
	}
	if (!cfg.has(globals.CfgSendFromEmail)) {
		window.showErrorMessage("No sender email-address provided");
		return;
	}
	if (!cfg.has(globals.CfgSendToEmail)) {
		window.showErrorMessage("No target email-address provided");
		return;
	}
	
	await globals.ensureInitialized(globals.currentEditor.document.uri);

	try {
		var workspaceRoot = workspace.getWorkspaceFolder(globals.currentEditor.document.uri)?.uri.fsPath
		workspaceRoot = workspaceRoot ? workspaceRoot : path.dirname(globals.currentEditor.document.fileName);
		var tplName = path.relative(workspaceRoot, globals.currentEditor.document.fileName);
		var ctxName = path.relative(workspaceRoot, item.location ?? '');
		const html = await getCompiledHtml(globals.currentEditor.document, item.location ?? '');
		const email = {
			to: cfg.get(globals.CfgSendToEmail) as string,
			from: { email: cfg.get(globals.CfgSendFromEmail) as string, name: 'Handlebars-Preview' },
			subject: `Handlebars-Preview :: TPL=${tplName} CTX=${ctxName}`,
			text: html,
			html: html
		};
		// using Twilio SendGrid's v3 Node.js Library
		// https://github.com/sendgrid/sendgrid-nodejs
		mail.setApiKey(cfg.get(globals.CfgSendGridApiKey) as string);
		mail.send(email);
		window.showInformationMessage(`Email has been sent to ${email.to}`);
	}
	catch (error:any) {
		window.showErrorMessage(`Error sending email: ${error?.message}`);
	}
}