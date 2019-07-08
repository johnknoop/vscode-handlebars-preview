import { commands, window, ExtensionContext, workspace, WorkspaceFolder, RelativePattern, Uri, TextDocument } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import generateContext from "./context-generator/context-generator";
import { Subject, race } from "rxjs";
import { debounceTime, filter, take, repeat } from "rxjs/operators";
import { partialsRegistered, findAndRegisterPartials, watchForPartials } from './partials';

const panels: PreviewPanelScope[] = [];
export const showErrorMessage = new Subject<string | null>();


export function activate(context: ExtensionContext) {
	hookupErrorMessages();

	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e);
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

	const generateContextFromExplorerCommand = commands.registerCommand('extension.generateContextFile', async (uri: Uri) => {
		const templateUri = uri
			? uri
			: window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
				? window.activeTextEditor.document.uri
				: null;

		if (templateUri) {
			await openPreviewPanelByUri(templateUri);
		}

		await generateContext(uri.fsPath);
	});

	const previewCommand = commands.registerCommand('extension.previewHandlebars', async (uri: Uri) => {
		const templateUri = uri
			? uri
			: window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
				? window.activeTextEditor.document.uri
				: null;

		if (templateUri) {
			await openPreviewPanelByUri(templateUri);
		}
	});

	context.subscriptions.push(previewCommand, ...watchForPartials(panels), generateContextFromExplorerCommand);
}

async function openPreviewPanelByUri(uri: Uri) {
	const existingPanel = panels.find(x => x.editorFilePath() === uri.fsPath);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		panels.splice(panels.indexOf(existingPanel), 1);
	}

	const doc = workspace.textDocuments.find(x => x.fileName === uri.fsPath)
		|| await workspace.openTextDocument(uri);

	await openPreviewPanelByDocument(doc);
}

async function openPreviewPanelByDocument(doc: TextDocument) {
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

	try {
		const panel = new PreviewPanelScope(doc);
		await panel.update();
		panels.push(panel);
	} catch (error) {
		throw error;
	}
}

function hookupErrorMessages() {
	const errorMessages = showErrorMessage.pipe(filter(x => typeof x === 'string'), debounceTime(1000));
	const resets = showErrorMessage.pipe(filter(x => x === null));
	race(errorMessages, resets)
		.pipe(take(1)).pipe(repeat())
		.subscribe(msg => {
			if (typeof msg === 'string') {
				window.showErrorMessage(msg);
			}
		});
}

export function deactivate() {
	panels.forEach(x => x.disposePreviewPanel());
}

