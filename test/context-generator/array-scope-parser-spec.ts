import { RootScope } from "../../src/context-generator/array-scope-parser";

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
	expect(result).toHaveProperty("someObject.reviewers");
});

test('should return all subscopes', () => {
	const rootScope = new RootScope(`
		{{#each myArray}}
			{{someOtherCrap}}
			{{#each subArray}} {{/each}}
		{{/each}}
		{{hello}}
	`);

	expect(rootScope.body.trim()).toBe('{{hello}}');

	const myArray = rootScope.childScopes[0];
	expect(myArray.identifier).toBe('myArray');
	expect(myArray.body.trim()).toBe('{{someOtherCrap}}');
	expect(myArray.childScopes[0].identifier).toBe('subArray');
	expect(myArray.childScopes[0].body.trim()).toBe('');
});

type CorrectResult = {
	someObject: {
		reviewers: Array<{
			firstName,
			lastName,
			email,
			age,
			deepArray: Array<{
				banana
			}>,
			orange
		}>
	}
};

test('should extract properties of each scope', () => {
	const scope = new RootScope(`{{rootProp1}}{{#each someObject.reviewers}}          
			{{firstName}}
			{{lastName}}
			{{email}}
			{{age}}

			{{# each deepArray}}		
				{{ banana }}
			{{/ each}}

			{{ orange }}
		{{ /each }}{{rootProp2}}
		`);

	const result = scope.getExpressions() as CorrectResult;

	expect(result).toHaveProperty('rootProp1');
	expect(result).toHaveProperty('rootProp2');

	expect(Object.keys(result).length).toBe(3);
	expect(result).toHaveProperty('someObject');

	expect(Object.keys(result.someObject).length).toBe(1);
	expect(result.someObject).toHaveProperty('reviewers');

	expect(Object.keys(result.someObject.reviewers[0]).length).toBe(6);
	expect(result.someObject.reviewers[0]).toHaveProperty('firstName');
	expect(result.someObject.reviewers[0]).toHaveProperty('lastName');
	expect(result.someObject.reviewers[0]).toHaveProperty('email');
	expect(result.someObject.reviewers[0]).toHaveProperty('age');
	expect(result.someObject.reviewers[0]).toHaveProperty('orange');
	expect(result.someObject.reviewers[0]).toHaveProperty('deepArray');

	expect(Object.keys(result.someObject.reviewers[0].deepArray[0]).length).toBe(1);
	expect(result.someObject.reviewers[0].deepArray[0]).toHaveProperty('banana');
});