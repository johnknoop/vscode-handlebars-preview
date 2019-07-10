import { extractArrayScopes } from "../src/context-generator/array-scope-parser";

test('Array scope parser deals with arrays in nested objects', () => {
	let hbs = `{{#>Partials/layout}}

	{{> header}}
	
	{{title}}
	{{author.name}}
	{{isConfirmed}}
	
	{{#each someObject.reviewers}}          
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

	const result = extractArrayScopes(hbs);

	expect(result).toHaveProperty('someObject.reviewers');
	expect(Array.isArray(result['someObject']['reviewers'])).toBe(true);

	console.log(JSON.stringify(result, null, 2));
})