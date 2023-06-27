import * as vscode from 'vscode';
import * as path from 'path';
import { Uri } from 'vscode';
import { HbsTreeItem, HbsContextTreeDataProvider } from './context-data-tree-provider';
import { globals } from './globals';

export function onActivation(context: vscode.ExtensionContext) {
	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
	? vscode.workspace.workspaceFolders[0].uri.fsPath
	: undefined;
	const treeView = new HbsContextTreeDataProvider(rootPath);
	vscode.window.registerTreeDataProvider('handlebarsContextChooser', treeView);
	vscode.commands.registerCommand(globals.CmdRefreshTree, onRefreshTree);
	vscode.commands.registerCommand(globals.CmdUseContext, onUseContext);
	vscode.workspace.onDidCloseTextDocument(onDidCloseTextDocument);
	vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);

	function onDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
		// let's keep last path when no editor is selected, but some files are still open
		if (!e && vscode.window.visibleTextEditors.length > 0) return;
		var dir = e && e.document.languageId === 'handlebars' ? path.dirname(e.document.fileName) : undefined;
		if (dir) globals.currentEditor = e;
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

	async function onRefreshTree(uri: Uri) {
		// vscode.debug.activeDebugConsole.appendLine(`executing command  ${uri}`);
		treeView && treeView.refresh();
	}

	async function onUseContext(item: HbsTreeItem) {
		if (globals.currentEditor) {
			const templateUri = globals.currentEditor.document.uri;
			await globals.openPreviewPanelByUri(templateUri, item.location);
		}
	}

	function onDidCloseTextDocument(doc) {
		// current file was closed, refresh tree
		var dir = doc && doc.languageId === 'handlebars' ? path.dirname(doc.fileName) : undefined;
		if (treeView.workingDir == dir) {
			treeView.workingDir = undefined;
			treeView.refresh();
		}
	}
}