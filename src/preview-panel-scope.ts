import { WebviewPanel, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window, TextDocument } from 'vscode';
import { promises, existsSync } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile, TemplateDelegate } from 'handlebars';
import { showErrorMessage } from "./extension";

export class PreviewPanelScope {
    private readonly panel: WebviewPanel;
    private readonly contextFileName: string;

    constructor(private readonly document: TextDocument, onPreviewPanelClosed: (panel: PreviewPanelScope) => void) {
        const contextFileName = getContextFileName(document.fileName);

        this.contextFileName = contextFileName;

        this.panel = window.createWebviewPanel("preview", `Preview: ${path.basename(document.fileName)}`, ViewColumn.Two, {
            localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(document.fileName)))
        });

        this.panel.onDidDispose(() => {
            onPreviewPanelClosed(this);
        });
    }

    editorFilePath() {
        return this.document.uri.fsPath;
    }

    async update() {
        const html = await getCompiledHtml(this.document, this.contextFileName, this);

        if (html) {
            this.panel.webview.html = html;
        }
    }

    showErrorPage(message: string) {
        this.panel.webview.html = `
        <html style="height: 100%;">
        <body style="height: 100%; display: flex; align-items: center; align-content: center; justify-content: center;"><span>${message}</span></body>
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
}

function getContextFileName(templateFileName: string): string {
    const contextFileName = `${templateFileName}.json`;

    if (!existsSync(contextFileName)) {
        window.showInformationMessage(`Tip: create a file named ${path.basename(contextFileName)} with your test data`);
    }

    return contextFileName;
}

function renderTemplate(template: TemplateDelegate, templateContext, panel: PreviewPanelScope) {
    try {
        const html = template(templateContext);

        showErrorMessage.next(null);

        return html;
    } catch (err) {
        showErrorMessage.next({ panel: panel, message: `Error rendering handlebars template: ${JSON.stringify(err)}` });
        return false;
    }
}

async function getCompiledHtml(templateDocument: TextDocument, contextFile: string, panel: PreviewPanelScope): Promise<string | false> {
    const context = await getContextData(contextFile);
    const template = templateDocument.getText();

    try {
        const compiledTemplate = compile(template);
        const rendered = renderTemplate(compiledTemplate, context, panel);
        
        if (rendered === false) {
            return false;
        }

        return repathLocalFiles(rendered || '', templateDocument);

    } catch (err) {
        showErrorMessage.next({ panel: panel, message: `Error rendering handlebars template: ${JSON.stringify(err)}` });
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

function repathLocalFiles(html: string, templateDocument: TextDocument) {
    const $ = loadDocument(html);

    // Images
    $('img')
        .filter((i, elm) =>
            // satisfy typing
            elm.type === 'tag' &&
            // Skip data-urls
            elm.attribs['src'].trimLeft().slice(0, 5).toLowerCase() !== 'data:' &&
            // Skip remote images
            !elm.attribs['src'].toLowerCase().startsWith('http')
        )
        .each((i, elm) => {
            // satisfy typing
            if (elm.type === 'tag') {
                elm.attribs['src'] = Uri.file(path.join(path.dirname(templateDocument.fileName), elm.attribs['src'])).with({ scheme: 'vscode-resource' }).toString();
            }
        });
    
    // CSS
    $('link')
        .filter((i, elm) => 
            // satisfy typing
            elm.type === 'tag' &&
            // Skip data-urls
            elm.attribs['href'].trimLeft().slice(0, 5).toLowerCase() !== 'data:' &&
            // Skip remote css
            !elm.attribs['href'].toLowerCase().startsWith('http') &&
            // Ensure only .css files
            elm.attribs['href'].toLowerCase().endsWith('.css')
        )
        .each((i, elm) => {
            // satisfy typing
            if (elm.type === 'tag') {

                const cacheClear = new Date().getTime();

                const newHref = elm.attribs['src'] = Uri
                    .file(path.join(path.dirname(templateDocument.fileName), elm.attribs['href']))
                    .with({ scheme: 'vscode-resource' }).toString();

                elm.attribs['href'] = `${newHref}?${cacheClear}`;
            }
        });

    const repathedHtml = $.html({
        decodeEntities: true
    });

    return repathedHtml;
}
