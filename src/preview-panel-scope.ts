import { WebviewPanel, TextEditor, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window, FileSystemWatcher, ExtensionContext } from 'vscode';
import { promises, existsSync } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile, TemplateDelegate } from 'handlebars';
import { showErrorMessage } from "./extension";

export class PreviewPanelScope {
    private readonly contextWatcher: FileSystemWatcher;
    private readonly panel: WebviewPanel;
    private readonly contextFileName: string;

    constructor(private readonly editor: TextEditor) {
        const contextFileName = getContextFileName(editor.document.fileName);

        this.contextFileName = contextFileName;

        this.panel = window.createWebviewPanel("preview", `Preview: ${path.basename(editor.document.fileName)}`, ViewColumn.Two, {
            localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(editor.document.fileName)))
        });

        this.panel.onDidDispose(() => {
            this.contextWatcher.dispose();
        });

        this.contextWatcher = workspace.createFileSystemWatcher(contextFileName);
        this.contextWatcher.onDidChange(e => {
            this.closePanelIfTemplateDocumentClosed();

            getCompiledHtml(this.editor, this.contextFileName).then(html => {
                if (html) {
                    this.panel.webview.html = html;
                }
            });
        });
    }

    public editorFilePath() {
        return this.editor.document.uri.fsPath;
    }

    public async update() {
        const html = await getCompiledHtml(this.editor, this.contextFileName);

        if (html) {
            this.panel.webview.html = html;
        }
    }

    disposePreviewPanel() {
        this.panel.dispose();
    }

    async workspaceDocumentChanged(event: TextDocumentChangeEvent) {
        if (event.document === this.editor.document || event.document.fileName === this.contextFileName) {
            this.closePanelIfTemplateDocumentClosed();
            await this.update();
        }
    }

    private closePanelIfTemplateDocumentClosed() {
        if (this.editor.document.isClosed) {
            this.disposePreviewPanel();
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

async function getCompiledHtml(templateEditor: TextEditor, contextFile: string): Promise<string | false> {
    const context = await getContextData(contextFile);
    const template = templateEditor.document.getText();

    try {
        const compiledTemplate = compile(template);
        const rendered = renderTemplate(compiledTemplate, context);
        
        return repathImages(rendered || '', templateEditor);

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

function repathImages(html: string, templateEditor: TextEditor) {
    const $ = loadDocument(html);

    $('img')
        .filter((i, elm) => !elm.attribs['src'].toLowerCase().startsWith('http'))
        .each((index, element) => {
            const newSrc = templateEditor.document.uri.with({
                scheme: 'vscode-resource',
                path: path.join(path.dirname(templateEditor.document.fileName), element.attribs['src']),
            }).toString();
            element.attribs['src'] = newSrc;
        });

    return $.html({
        decodeEntities: false
    });
}
