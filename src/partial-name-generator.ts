import * as path from 'path';

const abbreviatedNames: string[] = [];

export function generatePartialName(filePath: string, workspaceRoot: string) {
	const extension = path.extname(filePath);
	const relativePath = path.relative(workspaceRoot, filePath);

	return {
		registeredName: relativePath
			.slice(0, -extension.length)
			.replace(/\\/g, '/')
			.replace(/[^A-Za-z0-9/]/g, '-'),

		filePath: filePath,
	};
}

export function generatePartialNames(files: { filePath: string; workspaceRoot: string }[]) {
	var templates = files.map(({ filePath, workspaceRoot }) => generatePartialName(filePath, workspaceRoot));

	var abbreviatedPartials = templates
		.filter((x) => partialNameCanBeAbbreviated(x.registeredName))
		.map((x) => ({
			filePath: x.filePath,
			registeredName: abbreviatePartialName(x.registeredName),
			fullName: x.registeredName,
		}));

	abbreviatedPartials.forEach((x) => abbreviatedNames.push(x.fullName));

	return [
		...templates,
		...abbreviatedPartials
			// The ones where the abbreviated name isn't already taken
			.filter((abbr) => !templates.some((t) => t.registeredName === abbr.registeredName))
			.map((x) => ({
				filePath: x.filePath,
				registeredName: x.registeredName,
			})),
	];
}

export function partialNameCanBeAbbreviated(partialName: string) {
	return partialName.toLowerCase().startsWith('partials/');
}

export function abbreviatePartialName(partialName: string) {
	return partialNameCanBeAbbreviated(partialName) ? partialName.substring(9) : partialName;
}

export function partialHasAbbreviatedAlias(fullName: string) {
	return abbreviatedNames.includes(fullName);
}
