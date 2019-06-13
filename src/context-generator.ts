import { workspace, window, ViewColumn, Uri } from 'vscode';
import { existsSync, promises } from 'fs';

function extractJson(template: string): string {
    const result = {};

    const expressions = template.match(/{{{?\s?[^>#/].*?\s?}}}?/g);

    if (expressions) {

        const tokenChains = expressions
            .map(x => x.match(/{{{?\s?(.*?)\s?}}}?/))
            .filter(x => Array.isArray(x) && x.length > 1)
            .map(x => x![1].split('.'));

        tokenChains
            .sort(x => x.length)
            .forEach((tokens: string[]) => {

                let scope = result;
                
                tokens.forEach((token, index) => {
                    if (!(token in scope)) {
                        scope[token] = index === tokens.length - 1
                            ? ""
                            : {};
                    }

                    scope = scope[token];
                })
            });
    }

    return JSON.stringify(result, null, 2);
}

export default async function (activeTemplateFilename: string) {
    if (existsSync(`${activeTemplateFilename}.json`)) {
        return;
    }

    const template = await promises.readFile(activeTemplateFilename, 'utf8');
    const json = extractJson(template);

    await promises.writeFile(`${activeTemplateFilename}.json`, json, 'utf8');

    window.showTextDocument(Uri.file(`${activeTemplateFilename}.json`), {
        viewColumn: ViewColumn.Active
    });
}