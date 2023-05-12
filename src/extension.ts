import * as vscode from 'vscode';
import generateContext from "./context-generator/context-generator";
import { commands, window, ExtensionContext, workspace, Uri, TextDocument } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import { Subject, race } from "rxjs";
import { debounceTime, filter, take, repeat } from "rxjs/operators";
import { partialsRegistered, findAndRegisterPartials, watchForPartials } from './partials';
import { helpersRegistered, findAndRegisterHelpers, watchForHelpers } from './helpers';
import { HbsTreeItem, HbsContextTreeDataProvider } from './context-data-tree-provider';

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
		for (let i = panels.length - 1; i >= 0; i--) {
			const panel = panels[i];

			if (panel.editorFilePath() === doc.fileName) {
				panel.disposePreviewPanel();
				panels.splice(i, 1);
			}
		}
	});

	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;
	const provider = new HbsContextTreeDataProvider(rootPath);
	const onDidChangeActiveTextEditorHnd = vscode.window.onDidChangeActiveTextEditor(provider.onDidChangeActiveTextEditor.bind(provider));
	vscode.window.registerTreeDataProvider('handlebarsContextChooser', provider);
	const refreshTreeCommand = commands.registerCommand('extension.refreshTree', async (uri: Uri) => {
		// vscode.debug.activeDebugConsole.appendLine(`executing command  ${uri}`);
		provider && provider.refresh();
	});
	const useContextCommand = commands.registerCommand('extension.useContext', async (item: HbsTreeItem) => {
		const templateUri = getActiveTemplateUri(undefined);
		if (templateUri) {
			await openPreviewPanelByUri(templateUri, item.location);
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
}

function getActiveTemplateUri(uri: Uri|undefined): Uri|null {
	return uri ? uri
		: window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
			? window.activeTextEditor.document.uri
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

async function openPreviewPanelByDocument(doc: TextDocument, contextFileName: string|undefined) {
	const existingPanel = panels.find(x => x.editorFilePath() === doc.fileName);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		panels.splice(panels.indexOf(existingPanel), 1);
	}

	const workspaceRoot = workspace.getWorkspaceFolder(doc.uri);

	if (!workspaceRoot) {
		return;
	}

	if (!partialsRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterPartials(workspaceRoot);
	}

	if (!helpersRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterHelpers(workspaceRoot);
	}

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

