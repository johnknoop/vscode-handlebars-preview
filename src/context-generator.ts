import { window, ViewColumn, Uri } from 'vscode';
import { existsSync, promises } from 'fs';
import { extractJson } from './extract-json';

export default async function (activeTemplateFilename: string) {
    if (existsSync(`${activeTemplateFilename}.json`)) {
        window.showErrorMessage("This template already has a context file");
        return;
    }

    const template = await promises.readFile(activeTemplateFilename, 'utf8');
    const json = JSON.stringify(extractJson(template), null, 2);

    await promises.writeFile(`${activeTemplateFilename}.json`, json, 'utf8');

    window.showTextDocument(Uri.file(`${activeTemplateFilename}.json`), {
        viewColumn: ViewColumn.Active
    });
}