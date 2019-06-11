import { commands, window as win, ExtensionContext, ViewColumn, workspace, Uri, TextDocumentChangeEvent, TextEditor, WebviewPanel } from 'vscode';
import { readFileSync, existsSync, watch, FSWatcher } from "fs";
import { compile, registerPartial } from "handlebars";
import { load as loadDocument } from "cheerio";
import * as path from "path";

const watchers: {
	[fileName: string]: FSWatcher;
} = {};

function getContextFileName(templateFileName: string) {
	const dataFileName = `${templateFileName}.json`;

	if (!existsSync(dataFileName)) {
		const errorMessage = `Please create a file called ${dataFileName} with your test data`;
		win.showErrorMessage(errorMessage);
		return errorMessage;
	}

	return dataFileName;
}

function setupPartialsWatcher(rootDir) {
	watch(rootDir, {
		recursive: true
	})
}

function closePanelIfObsolete(templateEditor: TextEditor, panel: WebviewPanel) {
	if (templateEditor.document.isClosed) {
		panel.dispose();
	}
}

export function activate(context: ExtensionContext) {
	let disposable = commands.registerCommand('extension.previewHandlebars', () => {
		if (!win.activeTextEditor) {
			const errorMessage = `Please open a Handlebars file to preview`;
			return;
		}

		//setupPartialsWatcher()

		const templateEditor = win.activeTextEditor;
		const templateDocument = templateEditor.document;
		const dataFileName = getContextFileName(templateEditor.document.fileName);

		let panel = win.createWebviewPanel("preview", `Preview: ${path.basename(templateEditor.document.fileName)}`, ViewColumn.Two, {
			localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(templateDocument.fileName)))
		});

		panel.onDidDispose(() => {
			if (dataFileName in watchers) {
				watchers[dataFileName].close();
			}
		});

		panel.webview.html = getWebviewContent(templateEditor);

		if (dataFileName in watchers) {
			watchers[dataFileName].close();
		}

		watchers[dataFileName] = watch(dataFileName, () => {
			panel.webview.html = getWebviewContent(templateEditor);
		});

		workspace.onDidChangeTextDocument(e =>{
			if (e.document === templateDocument || e.document.fileName === dataFileName) {
				panel.webview.html = getWebviewContent(templateEditor);
			}
		});
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(templateEditor: TextEditor): string {
	const { document: currentActiveFile } = templateEditor;
	const dataFileName = getContextFileName(currentActiveFile.fileName);

	const data = JSON.parse(readFileSync(dataFileName, 'utf8'));
	const template = currentActiveFile.getText();

	const $ = loadDocument(template);

	$('img').each((index, element) => {
		const newSrc = currentActiveFile.uri.with({
			scheme: 'vscode-resource',
			path: path.join(path.dirname(currentActiveFile.fileName), element.attribs['src']),
		}).toString();

		element.attribs['src'] = newSrc;
	});

	const hbs = $.html({
		decodeEntities: false
	});
	const compiledTemplate = compile(hbs, {
		knownHelpersOnly: false,

	});

	return compiledTemplate(data);
}

export function deactivate() {
	for (const watcher in watchers) {
		watchers[watcher].close();
	}
}