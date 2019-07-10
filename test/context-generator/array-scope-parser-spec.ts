import { ArrayScope, RootScope } from "../../src/context-generator/array-scope-parser";

test('Returns nested if dots in name', () => {
	const scope = new RootScope(`{{#each someObject.reviewers}}          
			{{firstName}}
			{{lastName}}
			{{email}}
			{{age}}

			{{# each deepArray}}		
				{{ banana }}
			{{/ each}}

			{{ orange }}
		{{ /each }}
		`);
	
	const result = scope.getExpressions();

	console.log(JSON.stringify(result, null, 2));

	expect(result).toHaveProperty("someObject.reviewers");
});