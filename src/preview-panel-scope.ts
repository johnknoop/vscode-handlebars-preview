import { WebviewPanel, TextEditor, TextDocumentChangeEvent, ViewColumn, Uri, workspace, window } from 'vscode';
import { promises, FSWatcher, watch, existsSync } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile } from 'handlebars';

export class PreviewPanelScope {
    private readonly contextWatcher: FSWatcher;
    private readonly panel: WebviewPanel;
    private readonly contextFileName: string;

    constructor(private readonly editor: TextEditor) {
        const contextFileName = getContextFileName(editor.document.fileName);

        this.contextFileName = contextFileName;

        this.panel = window.createWebviewPanel("preview", `Preview: ${path.basename(editor.document.fileName)}`, ViewColumn.Two, {
			localResourceRoots: workspace.workspaceFolders!.map(p => p.uri).concat(Uri.file(path.dirname(editor.document.fileName)))
        });
        
		this.panel.onDidDispose(() => {
			this.contextWatcher.close();
		});

        this.contextWatcher = watch(contextFileName, (event, filename) => {
            this.closePanelIfTemplateDocumentClosed();

            getCompiledHtml(this.editor, this.contextFileName).then(html => {
                if (html) {
                    this.panel.webview.html = html;
                }
            });
        });

        
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
            const html = await getCompiledHtml(this.editor, this.contextFileName);
            
            if (html) {
                this.panel.webview.html = html;
            }
        }
    }

    private closePanelIfTemplateDocumentClosed() {
        if (this.editor.document.isClosed) {
            this.dispose();
        }
    }
}

function getContextFileName(templateFileName: string) {
    const contextFileName = `${templateFileName}.js`;
    const dataFileName = `${templateFileName}.json`;

    if (existsSync(contextFileName)) {
        window.showWarningMessage('JS context files not yet supported');
        throw false;
    }
    
	if (!existsSync(dataFileName)) {
		const errorMessage = `Please create a file called ${dataFileName} with your test data`;
		window.showErrorMessage(errorMessage);
		throw false;
	}

	return dataFileName;
}

async function getCompiledHtml(templateEditor: TextEditor, dataFileName: string): Promise<string | false> {
    const dataFileContents = await promises.readFile(dataFileName, 'utf8');
	const data = JSON.parse(dataFileContents);
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
            return compiledTemplate(data);
        } catch (err) {
            window.showErrorMessage(`Error rendering handlebars template`, err);
            return false;
        }
    } catch (err) {
        window.showErrorMessage(`Error compiling handlebars template`, err);
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
