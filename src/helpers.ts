import { registerHelper } from 'handlebars';
import { workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { PreviewPanelScope } from './preview-panel-scope';

const helpersRegisteredByWorkspace = {};

export function helpersRegistered(workspaceRoot: string) {
	return workspaceRoot in helpersRegisteredByWorkspace;
}

export async function findAndRegisterHelpers(workspaceFolder: WorkspaceFolder) {
	const jsFiles = await workspace.findFiles(new RelativePattern(workspaceFolder, '**/*.{hbs,handlebars}.js'));

	for (const js of jsFiles) {
		let helper = await import(js.fsPath);
		Object.keys(helper).forEach(key => registerHelper(key, helper[key]));
	}

	helpersRegisteredByWorkspace[workspaceFolder.uri.fsPath] = true;
}

export function* watchForHelpers(panels: PreviewPanelScope[]) {
	const watcher = workspace.createFileSystemWatcher('**/*.{hbs,handlebars}.js');

	yield watcher.onDidCreate(async (e) => {
		let helper = await import(e.fsPath);
		Object.keys(helper).forEach(key => registerHelper(key, helper[key]));

		for (const panel of panels) {
			await panel.update();
		}
	});

	yield watcher.onDidChange(async (e) => {
		// make sure to remove the previous module from the cache
		delete require.cache[require.resolve(e.fsPath)];
		// import the module
		let helper = await import(e.fsPath);
		Object.keys(helper).forEach(key => registerHelper(key, helper[key]));

		for (const panel of panels) {
			await panel.update();
		}
	});
}
