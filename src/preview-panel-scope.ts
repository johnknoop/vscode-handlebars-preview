import { WebviewPanel, TextEditor, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window, FileSystemWatcher } from 'vscode';
import { promises, existsSync } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile } from 'handlebars';

interface Context {
    data: Object,
    partials: {
        [name: string]: string;
    }
}

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
        })
    }

    public async update() {
        const html = await getCompiledHtml(this.editor, this.contextFileName);
        
        if (html) {
            this.panel.webview.html = html;
        }
    }

    dispose() {
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
            this.dispose();
        }
    }
}

function getContextFileName(templateFileName: string): string {
    const contextFileName = `${templateFileName}.json`;

    if (existsSync(contextFileName)) {
        return contextFileName;
    }

    const errorMessage = `Please create a file called ${contextFileName} with your test data`;
    window.showErrorMessage(errorMessage);
    throw false;
}

function validateContext(context: Context, fileName: string) {
    if (!context.hasOwnProperty('data')) {
        window.showErrorMessage(`The context file ${path.basename(fileName)} is missing the key 'data'.`);
        throw false;
    }

    if (typeof context.data !== 'object') {
        window.showErrorMessage(`The context file ${path.basename(fileName)} contains bad 'data' key.`);
        throw false;
    }

    if ('partials' in context && typeof context.partials !== 'object') {
        window.showErrorMessage(`The context file ${path.basename(fileName)} contains bad 'partials' key.`);
        throw false;
    }
}

async function getCompiledHtml(templateEditor: TextEditor, contextFile: string): Promise<string | false> {
    var contextJson = await promises.readFile(contextFile, 'utf8');
    const context: Context = JSON.parse(contextJson);
    const partials= {};
    validateContext(context, contextFile);

    for (const partialName in context.partials) {
        const partialAbsolutePath = path.resolve(path.dirname(templateEditor.document.fileName), context.partials[partialName]);
        const partialTemplate = await promises.readFile(partialAbsolutePath, 'utf8')
        partials[partialName] = partialTemplate;
    }

	const template = templateEditor.document.getText();

	const $ = loadDocument(template);
	repathImages($, templateEditor);

	const hbs = $.html({
		decodeEntities: false
    });
    
	try {
        const compiledTemplate = compile(hbs, {
            knownHelpersOnly: false
        });

        try {
            return compiledTemplate(context.data, {
                partials: partials
            });
        } catch (err) {
            window.showErrorMessage(`Error rendering handlebars template: ${JSON.stringify(err)}`);
            return false;
        }
    } catch (err) {
        window.showErrorMessage(`Error compiling handlebars template: ${JSON.stringify(err)}`);
        return false;
    }
}

function repathImages($: CheerioStatic, templateEditor: TextEditor) {
    $('img').each((index, element) => {
        const newSrc = templateEditor.document.uri.with({
            scheme: 'vscode-resource',
            path: path.join(path.dirname(templateEditor.document.fileName), element.attribs['src']),
        }).toString();
        element.attribs['src'] = newSrc;
    });
}
