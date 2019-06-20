import { commands, window, ExtensionContext, workspace, WorkspaceFolder, RelativePattern, Uri } from 'vscode';
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
			await panel.workspaceDocumentChanged(e)
		}
	});

	const generateContextFromEditorCommand = commands.registerTextEditorCommand('extension.generateContextFromEditor', async () => {
		const editor = window.activeTextEditor;
		
		if (!editor) {
			return;
		}

		await generateContext(editor.document.fileName);
	});

	const generateContextFromExplorerCommand = commands.registerCommand('extension.generateContextFromExplorer', async (uri:Uri) => {
		await generateContext(uri.fsPath);
	});


	const previewCommand = commands.registerTextEditorCommand('extension.previewHandlebars', async () => {
		const editor = window.activeTextEditor;

		if (!editor) {
			return;
		}

		const existingPanel = panels.find(x => x.editorFilePath() === editor.document.uri.fsPath);
		
		if (existingPanel) {
			existingPanel.disposePreviewPanel();
			panels.splice(panels.indexOf(existingPanel), 1);
		}

		const workspaceRoot = workspace.getWorkspaceFolder(editor.document.uri);

		if (!workspaceRoot) {
			return;
		}

		if (!partialsRegistered(workspaceRoot.uri.fsPath)) {
			await findAndRegisterPartials(workspaceRoot);
		}

		try {
			const panel = new PreviewPanelScope(editor);
			await panel.update();
			panels.push(panel);
		} catch (error) { 
			
		}
	});

	context.subscriptions.push(previewCommand,...watchForPartials(panels), generateContextFromEditorCommand, generateContextFromExplorerCommand);
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

