import { Uri, TextDocument } from 'vscode';
import { promises } from 'fs';
import { load as loadDocument } from "cheerio";
import * as path from "path";
import { compile, TemplateDelegate } from 'handlebars';

export async function getCompiledHtml(templateDocument: TextDocument, contextFile: string): Promise<string> {
	const context = await getContextData(contextFile);
	const template = templateDocument.getText();

	const compiledTemplate = compile(template);
	const rendered = renderTemplate(compiledTemplate, context);
	return repathLocalFiles(rendered || '', templateDocument);
}

function renderTemplate(template: TemplateDelegate, templateContext) {
	const html = template(templateContext);
	return html;
}

async function getContextData(contextFile: string) {
	var contextJson = await promises.readFile(contextFile, 'utf8');
	return JSON.parse(contextJson);
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
