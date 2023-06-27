import * as vscode from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';
import { Subject } from "rxjs";
import { window, workspace, Uri, TextDocument } from 'vscode';
import { race } from "rxjs";
import { debounceTime, filter, take, repeat } from "rxjs/operators";
import { partialsRegistered, findAndRegisterPartials } from './partials';
import { helpersRegistered, findAndRegisterHelpers } from './helpers';

class Globals {
	private _currentEditor: vscode.TextEditor | undefined;
	get currentEditor() { return this._currentEditor; }
	set currentEditor(value) { this._currentEditor = value; }

	public readonly extensionKey = 'handlebars-preview';

	public readonly CfgSendGridApiKey = 'email.sendGrid.apiKey';
	public readonly CfgSendFromEmail = 'email.fromEmailAddress';
	public readonly CfgSendToEmail = 'email.toEmailAddress';
	public readonly CfgContextFilter = 'context.filter';

	public readonly CmdRefreshTree = this.extensionKey + '.refreshTree';
	public readonly CmdUseContext = this.extensionKey + '.useContext';
	public readonly CmdSendEmail = this.extensionKey + '.sendPerEmail';

	public readonly DefaultContextFilter = /\.(hbs|handlebars)\.json/i;

	public readonly panels: PreviewPanelScope[] = [];
	public readonly showErrorMessage = new Subject<{ message: string; panel: PreviewPanelScope; } | null>();
	
	public getActiveTemplateUri(uri: Uri|undefined): Uri|null {
		if (uri) return uri;
		// var editor = getActiveHbsTextEditor();
		return this.currentEditor ? this.currentEditor.document.uri : null;
	}

	public getActiveHbsTextEditor(): vscode.TextEditor|null {
		return window && window.activeTextEditor && window.activeTextEditor.document.languageId === 'handlebars'
			? window.activeTextEditor
			: null;
	}

public async openPreviewPanelByUri(uri: Uri, contextFileName: string|undefined) {
	const existingPanel = this.panels.find(x => x.editorFilePath() === uri.fsPath);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		this.panels.splice(this.panels.indexOf(existingPanel), 1);
	}

	const doc = workspace.textDocuments.find(x => x.fileName === uri.fsPath)
		|| await workspace.openTextDocument(uri);

	await this.openPreviewPanelByDocument(doc, contextFileName);
}

public async ensureInitialized(uri:Uri) {
	const workspaceRoot = workspace.getWorkspaceFolder(uri);

	if (!workspaceRoot) {
		return;
	}

	if (!partialsRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterPartials(workspaceRoot);
	}

	if (!helpersRegistered(workspaceRoot.uri.fsPath)) {
		await findAndRegisterHelpers(workspaceRoot);
	}
}

public async openPreviewPanelByDocument(doc: TextDocument, contextFileName: string|undefined) {
	const existingPanel = this.panels.find(x => x.editorFilePath() === doc.fileName);

	if (existingPanel) {
		// Remove existing panel and open new one
		existingPanel.disposePreviewPanel();
		this.panels.splice(this.panels.indexOf(existingPanel), 1);
	}

	await this.ensureInitialized(doc.uri);

	try {
		const panel = new PreviewPanelScope(doc, contextFileName, this.onPreviewPanelClosed.bind(this));
		await panel.update();
		this.panels.push(panel);
	} catch (error) {
		throw error;
	}
}

public hookupErrorMessages() {
	const errorMessages = this.showErrorMessage.pipe(filter(x => x !== null), debounceTime(1000));
	const resets = this.showErrorMessage.pipe(filter(x => x === null));

	race(errorMessages, resets)
		.pipe(take(1)).pipe(repeat())
		.subscribe(msg => {
			if (msg !== null) {
				msg.panel.showErrorPage(msg.message);
			}
		});
}

private onPreviewPanelClosed(panel: PreviewPanelScope) {
	for (let i = this.panels.length - 1; i >= 0; i--) {
		if (this.panels[i] === panel) {
			this.panels.splice(i, 1);
		}
	}
}
}

export var globals = new Globals();

/*
export const extensionKey = 'handlebars-preview';

export const CfgSendGridApiKey = 'email.sendGrid.apiKey';
export const CfgSendFromEmail = 'email.fromEmailAddress';
export const CfgSendToEmail = 'email.toEmailAddress';
export const CfgContextFilter = 'context.filter';

export const CmdRefreshTree = extensionKey + '.refreshTree';
export const CmdUseContext = extensionKey + '.useContext';
export const CmdSendEmail = extensionKey + '.sendPerEmail';

export const DefaultContextFilter = /\.(hbs|handlebars)\.json/i;

export var currentEditor: vscode.TextEditor | undefined = undefined;
export const panels: PreviewPanelScope[] = [];
export const showErrorMessage = new Subject<{ message: string; panel: PreviewPanelScope; } | null>();
*/
