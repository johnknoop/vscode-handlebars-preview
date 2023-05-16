import { WebviewPanel, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window, TextDocument } from 'vscode';
import { existsSync } from 'fs';
import * as path from "path";
import { showErrorMessage } from './extension';
import { getCompiledHtml } from './merger';

export class PreviewPanelScope {
	private readonly panel: WebviewPanel;
	private readonly contextFileName: string;

	constructor(private readonly document: TextDocument, contextFileName:string|undefined, onPreviewPanelClosed: (panel: PreviewPanelScope) => void) {
		contextFileName = contextFileName ? contextFileName : getDefaultContextFileName(document.fileName);
		this.contextFileName = contextFileName;

		var title = this.buildTitle();
		this.panel = window.createWebviewPanel("preview", title, ViewColumn.Two, {
			localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(document.fileName))),
			enableScripts: true,
		});

		this.panel.onDidDispose(() => {
			onPreviewPanelClosed(this);
		});
	}

	editorFilePath() {
		return this.document.uri.fsPath;
	}

	async update() {
		showErrorMessage.next(null);
		try {
			const html = await getCompiledHtml(this.document, this.contextFileName);
			this.panel.webview.html = html;
		} catch (err) {
			var message = err?.toString();
			showErrorMessage.next({ panel: this, message: `<p>Error rendering handlebars template:</p><pre>${message}</pre>` });
		}
	}

	showErrorPage(message: string) {
		this.panel.webview.html = `
		<html>
		<body style="height: 100vh; margin 50%; display: flex; align-items: center; align-content: center; justify-content: center;"><span>${message}</span></body>
		</html>
		`;
	}

	disposePreviewPanel() {
		this.panel.dispose();
	}

	async workspaceDocumentChanged(event: TextDocumentChangeEvent) {
		if (event.document === this.document || event.document.fileName === this.contextFileName) {
			await this.update();
		}
	}

	async workspaceDocumentSaved(document: TextDocument) {
		if (document.fileName.toLowerCase().endsWith(".css")) {
			await this.update();
		}
	}

	private buildTitle(): string {
		var title = `Preview: ${path.basename(this.document.fileName)}`;
		if (this.contextFileName) {
			const workspaceRoot = workspace.getWorkspaceFolder(this.document.uri)!.uri.fsPath;
			var relName = path.relative(workspaceRoot, this.contextFileName);
			title = title + ` (${relName})`;
		}
		return title;
	}
}

function getDefaultContextFileName(templateFileName: string): string {
	const contextFileName = `${templateFileName}.json`;

	if (!existsSync(contextFileName)) {
		window.showInformationMessage(`Tip: create a file named ${path.basename(contextFileName)} with your test data`);
	}

	return contextFileName;
}
