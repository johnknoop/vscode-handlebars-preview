import partialNameGenerator from './partial-name-generator';
import { promises } from 'fs';
import { registerPartial } from 'handlebars';
import { workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';

const partialsRegisteredByWorkspace = {};

export function partialsRegistered(workspaceRoot: string) {
	return workspaceRoot in partialsRegisteredByWorkspace;
}

export async function findAndRegisterPartials(workspaceFolder: WorkspaceFolder) {
	const hbsFiles = await workspace.findFiles(new RelativePattern(workspaceFolder, '**/*.{hbs,handlebars}'));
	const knownPartials = {};

	for (const hbs of hbsFiles) {
		const workspaceFolder = workspace.getWorkspaceFolder(hbs);
		if (workspaceFolder) {
			knownPartials[partialNameGenerator(hbs.fsPath, workspaceFolder.uri.fsPath)] =
				await promises.readFile(hbs.fsPath, 'utf8');
		}
	}
	
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

		const partial = {
			[partialNameGenerator(
				e.fsPath, workspaceFolder.uri.fsPath)]: await promises.readFile(e.fsPath, 'utf8')
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

		registerPartial(partialNameGenerator(
			e.fsPath, workspaceFolder.uri.fsPath),
			await promises.readFile(e.fsPath, 'utf8')
		);

		for (const panel of panels) {
			await panel.update();
		}
	});
}