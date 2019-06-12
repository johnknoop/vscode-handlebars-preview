import { commands, window, ExtensionContext, workspace, WorkspaceFolder } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import partialNameGenerator from './partial-name-generator';
import { promises } from 'fs';
import { registerPartial } from 'handlebars';

const panels: PreviewPanelScope[] = [];
const partialsRegisteredByWorkspace = {};

function partialsRegistered(workspaceRoot: string) {
	return workspaceRoot in partialsRegisteredByWorkspace;
}

export function activate(context: ExtensionContext) {
	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e)
		}
	});

	// Future: support partial overrides using workspace.getConfiguration

	const previewCommand = commands.registerTextEditorCommand('extension.previewHandlebars', async () => {
		if (!window.activeTextEditor) {
			return;
		}

		const workspaceRoot = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);

		if (!workspaceRoot) {
			return;
		}

		if (!partialsRegistered(workspaceRoot.uri.fsPath)) {
			await findAndRegisterPartials();
		}

		try {
			const panel = new PreviewPanelScope(window.activeTextEditor);
			await panel.update();
			panels.push(panel);
		} catch (error) { }
	});

	context.subscriptions.push(previewCommand,...watchForPartials());
}

export function deactivate() {
	panels.forEach(x => x.dispose());
}

async function findAndRegisterPartials() {
	const hbsFiles = await workspace.findFiles('**/*.{hbs,handlebars}');
	const knownPartials = {};

	for (const hbs of hbsFiles) {
		const workspaceFolder = workspace.getWorkspaceFolder(hbs);
		if (workspaceFolder) {
			knownPartials[partialNameGenerator(hbs.fsPath, workspaceFolder.uri.fsPath)] =
				await promises.readFile(hbs.fsPath, 'utf8');
		}
	}
	
	registerPartial(knownPartials);
	
	const workspaceFolders = workspace.workspaceFolders;

	workspaceFolders && workspaceFolders.forEach(f => {
		partialsRegisteredByWorkspace[f.uri.fsPath] = true;
	});
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