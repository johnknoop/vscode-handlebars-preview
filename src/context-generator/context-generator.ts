import { window, ViewColumn, Uri } from 'vscode';
import { existsSync, promises } from 'fs';
import generateContextObject from "./array-scope-parser";

export default async function (templateFilename: string) {
    if (existsSync(`${templateFilename}.json`)) {
        window.showWarningMessage("This template already has a context file. Will not overwrite.");
    } else {
        const template = await promises.readFile(templateFilename, 'utf8');
        const json = generateContextObject(template);

        await promises.writeFile(`${templateFilename}.json`, json, 'utf8');
    }
    
    window.showTextDocument(Uri.file(`${templateFilename}.json`), {
        viewColumn: ViewColumn.Active
    });
}

// #region For testing purposes only 😲
let hbs = `{{#>Partials/layout}}

{{> header}}

{{title}}
{{author.name}}
{{isConfirmed}}

{{#each reviewers}}          
	{{firstName}}
	{{lastName}}
	{{email}}
	{{age}}

	{{# each deepArray}}		
		  {{ banana }}
	{{/ each}}

	{{ orange }}
{{ /each }}

{{signature}}

{{#each otherthings as  |value key| }}		
	{{firstName}}
{{/each}}


{{/Partials/layout}}`;

console.log(generateContextObject(hbs));
// #endregion