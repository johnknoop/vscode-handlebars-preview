import { commands, window, ExtensionContext, workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import partialNameGenerator from './partial-name-generator';
import { promises } from 'fs';
import { registerPartial } from 'handlebars';
import generateContext from "./context-generator";
import { Subject, race } from "rxjs";
import { debounceTime, groupBy, flatMap, filter, take, repeat } from "rxjs/operators";

const panels: PreviewPanelScope[] = [];
const partialsRegisteredByWorkspace = {};

export const showErrorMessage = new Subject<string | null>();

function partialsRegistered(workspaceRoot: string) {
	return workspaceRoot in partialsRegisteredByWorkspace;
}

export function activate(context: ExtensionContext) {
	hookupErrorMessages();

	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e)
		}
	});

	const generateContextCommand = commands.registerTextEditorCommand('extension.generateContext', async (args) => {
		const editor = window.activeTextEditor;

		if (!editor) {
			return;
		}

		await generateContext(editor.document.fileName);
	});


	// Future: support partial overrides using workspace.getConfiguration

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

	context.subscriptions.push(previewCommand,...watchForPartials(), generateContextCommand);
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

async function findAndRegisterPartials(workspaceFolder: WorkspaceFolder) {
	const hbsFiles = await workspace.findFiles(new RelativePattern(workspaceFolder, '**/*.{hbs,handlebars}'));
	const knownPartials = {};

	for (const hbs of hbsFiles) {
		const workspaceFolder = workspace.getWorkspaceFolder(hbs);
		if (workspaceFolder) {
			knownPartials[partialNameGenerator(hbs.fsPath, workspaceFolder.uri.fsPath)] =
				await promises.readFile(hbs.fsPath, 'utf8');
		}
	}
	
	registerPartial(knownPartials);

	partialsRegisteredByWorkspace[workspaceFolder.uri.fsPath] = true;
}

function* watchForPartials() {
	const watcher = workspace.createFileSystemWatcher('**/*.{hbs,handlebars}');

	yield watcher.onDidCreate(async (e) => {
		const workspaceFolder = workspace.getWorkspaceFolder(e);

		if (!workspaceFolder) {
			return;
		}

		const partial = {
			[partialNameGenerator(
				e.fsPath, workspaceFolder.uri.fsPath)]: await promises.readFile(e.fsPath, 'utf8')
		} as any;

		registerPartial(partial);

		for (const panel of panels) {
			await panel.update();
		}
	});

	yield watcher.onDidChange(async (e) => {
		const workspaceFolder = workspace.getWorkspaceFolder(e);

		if (!workspaceFolder) {
			return;
		}

		registerPartial(partialNameGenerator(
			e.fsPath, workspaceFolder.uri.fsPath),
			await promises.readFile(e.fsPath, 'utf8')
		);

		for (const panel of panels) {
			await panel.update();
		}
	});
}