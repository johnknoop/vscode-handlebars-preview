import { commands, window, ExtensionContext, workspace } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';

const panels: PreviewPanelScope[] = [];

export function activate(context: ExtensionContext) {
	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e)
		}
	});

	const generateContextCommand = commands.registerTextEditorCommand('extension.generateHandlebarsContext', async () => {

	});

	const generateConfigCommand = commands.registerCommand('extension.generateHandlebarsConfig', async () => {
		
	});

	const previewCommand = commands.registerTextEditorCommand('extension.previewHandlebars', async () => {
		if (!window.activeTextEditor) {
			return;
		}

		try {
			const panel = new PreviewPanelScope(window.activeTextEditor);
			await panel.update();
			panels.push(panel);
		} catch (error) { }
	});

	const watcher = workspace.createFileSystemWatcher('**/*.{hbs,handlebars}');

	context.subscriptions.push(previewCommand, generateContextCommand, generateConfigCommand);

	context.subscriptions.push(watcher.onDidChange(async () => {
		for (const panel of panels) {
			await panel.update();
		}
	}));
}

export function deactivate() {
	panels.forEach(x => x.dispose());
}