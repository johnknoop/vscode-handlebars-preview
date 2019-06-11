import { commands, window, ExtensionContext, workspace } from 'vscode';
import * as path from "path";
import { FSWatcher, watch, promises } from 'fs';
import { PreviewPanelScope } from './preview-panel-scope';
import { registerPartial, unregisterPartial } from "handlebars";
import generateConfig from "./generate-config";

const partialsWatchers: {
	[workspace: string]: FSWatcher;
} = {};

const panels: PreviewPanelScope[] = [];

function closePartialsWatchers() {
	for (const watcher in partialsWatchers) {
		partialsWatchers[watcher].close();
	}
}

function watchWorkspaceFoldersForPartials() {
	closePartialsWatchers();

	if (!workspace.workspaceFolders) {
		return;
	}

	// todo: använd workspace.createFileSystemWatcher istället
	workspace.workspaceFolders.forEach(x => {
		partialsWatchers[x.name] = watch(x.uri.fsPath, {
			recursive: true
		}, async (e, filename) => {
			if (['.hbs', '.handlebars'].includes(path.extname(filename))) {
				for (const panel of panels) {
					await panel.update();
				}
			}
		});
	});
}

export function activate(context: ExtensionContext) {
	workspace.onDidChangeTextDocument(async e => {
		for (const panel of panels) {
			await panel.workspaceDocumentChanged(e)
		}
	});

	watchWorkspaceFoldersForPartials();

	const generateContextCommand = commands.registerTextEditorCommand('extension.generateHandlebarsContext', async () => {

	});

	const generateConfigCommand = commands.registerCommand('extension.generateHandlebarsConfig', async () => {
		
	});

	const previewCommand = commands.registerTextEditorCommand('extension.previewHandlebars', async () => {
		if (!window.activeTextEditor) {
			return;
		}

		workspace.onDidChangeWorkspaceFolders(_ => { watchWorkspaceFoldersForPartials() });

		try {
			const panel = new PreviewPanelScope(window.activeTextEditor);
			await panel.update();
			panels.push(panel);
		} catch (error) { }
	});

	context.subscriptions.push(previewCommand, generateContextCommand, generateConfigCommand);
}

export function deactivate() {
	panels.forEach(x => x.dispose());

	closePartialsWatchers();
}