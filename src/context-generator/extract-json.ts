import generateSampleValue from './sample-data-generator';

export function extractJson(hbs: string): Object {
	const result = {};
	const expressions = hbs.match(/{{{?\s?[^>#/].*?\s?}}}?/g);
	if (expressions) {
		const tokenChains = expressions
			.map((x) => x.match(/{{{?\s?(.*?)\s?}}}?/))
			.filter((x) => Array.isArray(x) && x.length > 1)
			.map((x) => x![1].split('.').filter((x) => x.trim().toLowerCase() !== 'this'));

		tokenChains
			.sort((x) => x.length)
			.forEach((tokens: string[]) => {
				let scope = result;

				tokens.forEach((token, index) => {
					if (!(token in scope)) {
						scope[token] = index === tokens.length - 1 ? generateSampleValue(token) : {};
					}
					scope = scope[token];
				});
			});
	}

	return result;
}
