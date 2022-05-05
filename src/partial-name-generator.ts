import * as path from "path";

export function generatePartialName(filePath: string, workspaceRoot: string) {
	const extension = path.extname(filePath);
		const relativePath = path.relative(workspaceRoot, filePath);
		
		return {
			registeredName: relativePath.slice(0, -extension.length)
				.replace(/\\/g, '/')
				.replace(/[^A-Za-z0-9/]/g, '-'),
			filePath: filePath
		};
}

export function generatePartialNames(files: {filePath: string, workspaceRoot: string}[]) {
	var templates = files.map(({filePath, workspaceRoot}) => generatePartialName(filePath, workspaceRoot));

	var abrevatedPartials = templates
		.filter(x => x.registeredName.toLowerCase().startsWith('partials/'))
		.map(x => ({
			filePath: x.filePath,
			registeredName: x.registeredName.substring(9)
		}));

	return [
		...templates,
		...abrevatedPartials
			// The ones where the abbreviated name isn't already taken
			.filter(abbr => !templates.some(t => t.registeredName === abbr.registeredName))
	];
}