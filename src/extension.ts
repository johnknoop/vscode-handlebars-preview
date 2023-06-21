import * as vscode from 'vscode';
import * as path from 'path';
import * as mail from '@sendgrid/mail';
import * as globals from './globals';
import generateContext from "./context-generator/context-generator";
import { commands, window, ExtensionContext, workspace, Uri, TextDocument } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import { Subject, race } from "rxjs";
import { debounceTime, filter, take, repeat } from "rxjs/operators";
import { partialsRegistered, findAndRegisterPartials, watchForPartials } from './partials';
import { helpersRegistered, findAndRegisterHelpers, watchForHelpers } from './helpers';
import { HbsTreeItem, HbsContextTreeDataProvider } from './context-data-tree-provider';
import { getCompiledHtml } from './merger';

let currentEditor: vscode.TextEditor | undefined = undefined;
const panels: PreviewPanelScope[] = [];
export const showErrorMessage = new Subject<{ message: string; panel: PreviewPanelScope; } | null>();

function onPreviewPanelClosed(panel: PreviewPanelScope) {
	for (let i = panels.length - 1; i >= 0; i--) {
		if (panels[i] === panel) {
			panels.splice(i, 1);
		}
	}
}

export function activate(context: ExtensionContext) {
	hookupErrorMessages();

	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e);
		}
	});

	workspace.onDidSaveTextDocument(async doc => {
		for (const panel of panels) {
			await panel.workspaceDocumentSaved(doc);
		}
	});

	workspace.onDidCloseTextDocument(doc => {
		// current file was closed, refresh tree
		var dir = doc && doc.languageId === 'handlebars' ? path.dirname(doc.fileName) : undefined;
		if (treeView.workingDir == dir) {
			treeView.workingDir = undefined;
			treeView.refresh();
		}

		for (let i = panels.length - 1; i >= 0; i--) {
			const panel = panels[i];

			if (panel.editorFilePath() === doc.fileName) {
				panel.disposePreviewPanel();
				panels.splice(i, 1);
			}
		}
	});

	window.onDidChangeActiveTextEditor(checkIsHandlebarsFile);

	function checkIsHandlebarsFile(e: vscode.TextEditor | undefined) {
		// let's keep last path when no editor is selected, but some files are still open
		if (!e && vscode.window.visibleTextEditors.length > 0) return;
		var dir = e && e.document.languageId === 'handlebars' ? path.dirname(e.document.fileName) : undefined;
		if (dir) currentEditor = e;
		if (treeView.workingDir != dir) {
			treeView.hbsTemplateFilename = e ? e.document.fileName : undefined;
			const cfg = vscode.workspace.getConfiguration(globals.extensionKey);
			treeView.contextFilter = globals.DefaultContextFilter;
			if (e && cfg.get(globals.CfgContextFilter)) {
				var parts = path.parse(e.document.fileName);
				var hbsFilename = parts.name.toLowerCase();
				treeView.contextFilter = new RegExp(hbsFilename + ".*" + String.raw`\.(hbs|handlebars)\.json`, 'i');
			}
			treeView.workingDir = dir;
			treeView.refresh();
		}
	}

	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;
	const treeView = new HbsContextTreeDataProvider(rootPath);
	vscode.window.registerTreeDataProvider('handlebarsContextChooser', treeView);
	commands.registerCommand(globals.CmdRefreshTree, async (uri: Uri) => {
		// vscode.debug.activeDebugConsole.appendLine(`executing command  ${uri}`);
		treeView && treeView.refresh();
	});
	commands.registerCommand(globals.CmdUseContext, async (item: HbsTreeItem) => {
		if (currentEditor) {
			const templateUri = currentEditor.document.uri;
			await openPreviewPanelByUri(templateUri, item.location);
		}
	});
	commands.registerCommand(globals.CmdSendEmail, async (item: HbsTreeItem) => {
		if (!currentEditor) {
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
		
		await ensureInitialized(currentEditor.document.uri);

		try {
			var workspaceRoot = workspace.getWorkspaceFolder(currentEditor.document.uri)?.uri.fsPath
			workspaceRoot = workspaceRoot ? workspaceRoot : path.dirname(currentEditor.document.fileName);
			var tplName = path.relative(workspaceRoot, currentEditor.document.fileName);
			var ctxName = path.relative(workspaceRoot, item.location ?? '');
			const html = await getCompiledHtml(currentEditor.document, item.location ?? '');
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
	});

	const generateContextFromExplorerCommand = commands.registerCommand('extension.generateContextFile', async (uri: Uri) => {
		const templateUri = uri
			? uri
			: window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
				? window.activeTextEditor.document.uri
				: null;

		if (!templateUri) {
			window.showInformationMessage('Please save the template in order to generate context file');
			return;
		}

		await generateContext(templateUri!.fsPath);
	});

	const previewCommand = commands.registerCommand('extension.previewHandlebars', async (uri: Uri) => {
		const templateUri = getActiveTemplateUri(uri);
		if (templateUri) {
			await openPreviewPanelByUri(templateUri, undefined);
		}
	});

	context.subscriptions.push(previewCommand, ...watchForPartials(panels), generateContextFromExplorerCommand);
	context.subscriptions.push(previewCommand, ...watchForHelpers(panels), generateContextFromExplorerCommand);

	checkIsHandlebarsFile(vscode.window.activeTextEditor);
}

function getActiveTemplateUri(uri: Uri|undefined): Uri|null {
	if (uri) return uri;
	// var editor = getActiveHbsTextEditor();
	return currentEditor ? currentEditor.document.uri : null;
}

function getActiveHbsTextEditor(): vscode.TextEditor|null {
	return window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
		? window.activeTextEditor
		: null;
}

async function openPreviewPanelByUri(uri: Uri, contextFileName: string|undefined) {
	const existingPanel = panels.find(x => x.editorFilePath() === uri.fsPath);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		panels.splice(panels.indexOf(existingPanel), 1);
	}

	const doc = workspace.textDocuments.find(x => x.fileName === uri.fsPath)
		|| await workspace.openTextDocument(uri);

	await openPreviewPanelByDocument(doc, contextFileName);
}

async function ensureInitialized(uri:Uri) {
	const workspaceRoot = workspace.getWorkspaceFolder(uri);

	if (!workspaceRoot) {
		return;
	}

	if (!partialsRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterPartials(workspaceRoot);
	}

	if (!helpersRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterHelpers(workspaceRoot);
	}
}

async function openPreviewPanelByDocument(doc: TextDocument, contextFileName: string|undefined) {
	const existingPanel = panels.find(x => x.editorFilePath() === doc.fileName);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		panels.splice(panels.indexOf(existingPanel), 1);
	}

	await ensureInitialized(doc.uri);

	try {
		const panel = new PreviewPanelScope(doc, contextFileName, onPreviewPanelClosed);
		await panel.update();
		panels.push(panel);
	} catch (error) {
		throw error;
	}
}

function hookupErrorMessages() {
	const errorMessages = showErrorMessage.pipe(filter(x => x !== null), debounceTime(1000));
	const resets = showErrorMessage.pipe(filter(x => x === null));

	race(errorMessages, resets)
		.pipe(take(1)).pipe(repeat())
		.subscribe(msg => {
			if (msg !== null) {
				msg.panel.showErrorPage(msg.message);
			}
		});
}

export function deactivate() {
	panels.forEach(x => x.disposePreviewPanel());
}

