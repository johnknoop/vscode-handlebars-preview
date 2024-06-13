import { window, ViewColumn, Uri } from 'vscode';
import { existsSync, promises } from 'fs';
import { extractArrayScopes } from './array-scope-parser';

export default async function (templateFilename: string) {
	if (existsSync(`${templateFilename}.json`)) {
		window.showWarningMessage('This template already has a context file. Will not overwrite.');
	} else {
		const template = await promises.readFile(templateFilename, 'utf8');
		const arrayScopes = extractArrayScopes(template);
		const json = JSON.stringify(arrayScopes, null, 2);

		await promises.writeFile(`${templateFilename}.json`, json, 'utf8');
	}

	window.showTextDocument(Uri.file(`${templateFilename}.json`), {
		viewColumn: ViewColumn.Active,
	});
}
