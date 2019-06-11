import { commands, window, ExtensionContext, workspace } from 'vscode';

import { FSWatcher } from 'fs';
import { PreviewPanelScope } from './preview-panel-scope';

const watchers: {
	[fileName: string]: FSWatcher;
} = {};



const panels: PreviewPanelScope[] = [];

export function activate(context: ExtensionContext) {
	workspace.onDidChangeTextDocument(async e =>{
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e)
		}
	});

	let disposable = commands.registerCommand('extension.previewHandlebars', async () => {
		if (!window.activeTextEditor) {
			return;
		}

		try {
			const panel = new PreviewPanelScope(window.activeTextEditor);
			
			await panel.update();

			panels.push(panel);
		} catch (error) {
			// Do nothing
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	panels.forEach(x => x.dispose());

	for (const watcher in watchers) {
		watchers[watcher].close();
	}
}