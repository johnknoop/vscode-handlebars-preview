import * as vscode from 'vscode';
import * as path from 'path';
import * as treeview from './treeview';
import * as sendgrid from './sendgrid';
import { globals } from './globals';
import { watchForPartials } from './partials';
import { watchForHelpers } from './helpers';
import generateContext from "./context-generator/context-generator";

export function activate(context: vscode.ExtensionContext) {
	globals.hookupErrorMessages();

	vscode.workspace.onDidChangeTextDocument(async e => {
		for (const panel of globals.panels) {
			await panel.workspaceDocumentChanged(e);
		}
	});

	vscode.workspace.onDidSaveTextDocument(async doc => {
		for (const panel of globals.panels) {
			await panel.workspaceDocumentSaved(doc);
		}
	});

	vscode.workspace.onDidCloseTextDocument(doc => {
		for (let i = globals.panels.length - 1; i >= 0; i--) {
			const panel = globals.panels[i];

			if (panel.editorFilePath() === doc.fileName) {
				panel.disposePreviewPanel();
				globals.panels.splice(i, 1);
			}
		}
	});

	vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);

	const generateContextFromExplorerCommand = vscode.commands.registerCommand('extension.generateContextFile', async (uri: vscode.Uri) => {
		const templateUri = uri
			? uri
			: vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'handlebars'
				? vscode.window.activeTextEditor.document.uri
				: null;

		if (!templateUri) {
			vscode.window.showInformationMessage('Please save the template in order to generate context file');
			return;
		}

		await generateContext(templateUri!.fsPath);
	});

	const previewCommand = vscode.commands.registerCommand('extension.previewHandlebars', async (uri: vscode.Uri) => {
		const templateUri = globals.getActiveTemplateUri(uri);
		if (templateUri) {
			await globals.openPreviewPanelByUri(templateUri, undefined);
		}
	});

	treeview.onActivation(context);
	sendgrid.onActivation(context);

	context.subscriptions.push(previewCommand, ...watchForPartials(globals.panels), generateContextFromExplorerCommand);
	context.subscriptions.push(previewCommand, ...watchForHelpers(globals.panels), generateContextFromExplorerCommand);

	onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
}

export function deactivate() {
	globals.panels.forEach(x => x.disposePreviewPanel());
}

	function onDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
		// let's keep last path when no editor is selected, but some files are still open
		if (!e && vscode.window.visibleTextEditors.length > 0) return;
		var dir = e && e.document.languageId === 'handlebars' ? path.dirname(e.document.fileName) : undefined;
		if (dir) globals.currentEditor = e;
	}

