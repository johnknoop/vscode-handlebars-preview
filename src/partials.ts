import {
	abbreviatePartialName,
	generatePartialName,
	generatePartialNames,
	partialHasAbbreviatedAlias,
	partialNameCanBeAbbreviated,
} from './partial-name-generator';
import { promises } from 'fs';
import { registerPartial, partials, unregisterPartial } from 'handlebars';
import { workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';

const partialsRegisteredByWorkspace = {};

export function partialsRegistered(workspaceRoot: string) {
	return workspaceRoot in partialsRegisteredByWorkspace;
}

export async function findAndRegisterPartials(workspaceFolder: WorkspaceFolder) {
	const hbsFiles = await workspace.findFiles(new RelativePattern(workspaceFolder, '**/*.{hbs,handlebars}'));

	const foundTemplates = hbsFiles
		.map((x) => ({
			filePath: x.fsPath,
			workspaceRoot: workspace.getWorkspaceFolder(x),
		}))
		.filter((x) => x.workspaceRoot)
		.map((x) => ({
			filePath: x.filePath,
			workspaceRoot: x.workspaceRoot!.uri.fsPath,
		}));

	const knownPartials = await generatePartialNames(foundTemplates).reduce(async (map, t) => {
		return {
			...(await map),
			[t.registeredName]: await promises.readFile(t.filePath, 'utf8'),
		};
	}, Promise.resolve({}));

	registerPartial(knownPartials);

	partialsRegisteredByWorkspace[workspaceFolder.uri.fsPath] = true;
}

export function* watchForPartials(panels: PreviewPanelScope[]) {
	const watcher = workspace.createFileSystemWatcher('**/*.{hbs,handlebars}');

	yield watcher.onDidCreate(async (e) => {
		const workspaceFolder = workspace.getWorkspaceFolder(e);

		if (!workspaceFolder) {
			return;
		}

		const partialName = generatePartialName(e.fsPath, workspaceFolder.uri.fsPath);

		const partial = {
			[partialName.registeredName]: await promises.readFile(e.fsPath, 'utf8'),
		} as any;

		registerPartial(partial);

		for (const panel of panels) {
			await panel.update();
		}
	});

	yield watcher.onDidChange(async (e) => {
		const workspaceFolder = workspace.getWorkspaceFolder(e);

		if (!workspaceFolder) {
			return;
		}

		const partialName = generatePartialName(e.fsPath, workspaceFolder.uri.fsPath);
		const partialTemplateContent = await promises.readFile(e.fsPath, 'utf8');

		registerPartial(partialName.registeredName, partialTemplateContent);

		if (partialNameCanBeAbbreviated(partialName.registeredName) && partialHasAbbreviatedAlias(partialName.registeredName)) {
			const abbreviatedName = abbreviatePartialName(partialName.registeredName);

			registerPartial(abbreviatedName, partialTemplateContent);
		}

		for (const panel of panels) {
			await panel.update();
		}
	});
}
