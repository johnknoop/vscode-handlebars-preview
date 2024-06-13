import { extractJson } from '../../src/context-generator/extract-json';

test('should generate sample data for all expressions', () => {
	const template = `{{firstName}} {{lastName}}`;

	const result = extractJson(template);

	expect(result).toHaveProperty('firstName');
});
