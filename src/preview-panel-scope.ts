import { WebviewPanel, TextEditor, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window, FileSystemWatcher, ExtensionContext, TextDocument } from 'vscode';
import { promises, existsSync } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile, TemplateDelegate } from 'handlebars';
import { showErrorMessage } from "./extension";

export class PreviewPanelScope {
    private readonly contextWatcher: FileSystemWatcher;
    private readonly panel: WebviewPanel;
    private readonly contextFileName: string;

    constructor(private readonly document: TextDocument) {
        const contextFileName = getContextFileName(document.fileName);

        this.contextFileName = contextFileName;

        this.panel = window.createWebviewPanel("preview", `Preview: ${path.basename(document.fileName)}`, ViewColumn.Two, {
            localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(document.fileName)))
        });

        this.panel.onDidDispose(() => {
            this.contextWatcher.dispose();
        });

        this.contextWatcher = workspace.createFileSystemWatcher(contextFileName);
        this.contextWatcher.onDidChange(e => {
            getCompiledHtml(this.document, this.contextFileName).then(html => {
                if (html) {
                    this.panel.webview.html = html;
                }
            });
        });
    }

    editorFilePath() {
        return this.document.uri.fsPath;
    }

    async update() {
        const html = await getCompiledHtml(this.document, this.contextFileName);

        if (html) {
            this.panel.webview.html = html;
        }
    }

    disposePreviewPanel() {
        this.panel.dispose();
    }

    async workspaceDocumentChanged(event: TextDocumentChangeEvent) {
        if (event.document === this.document || event.document.fileName === this.contextFileName) {
            await this.update();
        }
    }
}

function getContextFileName(templateFileName: string): string {
    const contextFileName = `${templateFileName}.json`;

    if (!existsSync(contextFileName)) {
        window.showInformationMessage(`Tip: create a file named ${path.basename(contextFileName)} with your test data`);
    }

    return contextFileName;
}

function renderTemplate(template: TemplateDelegate, templateContext) {
    try {
        const html = template(templateContext);

        showErrorMessage.next(null);

        return html;
    } catch (err) {
        showErrorMessage.next(`Error rendering handlebars template: ${JSON.stringify(err)}`);
        return false;
    }
}

async function getCompiledHtml(templateDocument: TextDocument, contextFile: string): Promise<string | false> {
    const context = await getContextData(contextFile);
    const template = templateDocument.getText();

    try {
        const compiledTemplate = compile(template);
        const rendered = renderTemplate(compiledTemplate, context);
        
        return repathImages(rendered || '', templateDocument);

    } catch (err) {
        showErrorMessage.next(`Error compiling handlebars template: ${JSON.stringify(err)}`);
        return false;
    }
}

async function getContextData(contextFile: string) {
    try {
        var contextJson = await promises.readFile(contextFile, 'utf8');
        return JSON.parse(contextJson);
    } catch (err) {
        return {};
    }
}

function repathImages(html: string, templateDocument: TextDocument) {
    const $ = loadDocument(html);

    $('img')
        .filter((i, elm) => !elm.attribs['src'].toLowerCase().startsWith('http'))
        .each((index, element) => {
            const newSrc = templateDocument.uri.with({
                scheme: 'vscode-resource',
                path: path.join(path.dirname(templateDocument.fileName), element.attribs['src']),
            }).toString();
            element.attribs['src'] = newSrc;
        });

    return $.html({
        decodeEntities: false
    });
}
