import generateContextObject from "../src/context-generator/array-scope-parser";

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

	const result = generateContextObject(hbs);

	console.log(result);
})