import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as globals from './globals';

export class HbsContextTreeDataProvider implements vscode.TreeDataProvider<HbsTreeItem> {

	workingDir: string|undefined;
	hbsTemplateFilename: string|undefined;
	contextFilter:RegExp = globals.DefaultContextFilter;
	private treeChangedEvent: vscode.EventEmitter<HbsTreeItem | null | undefined> = new vscode.EventEmitter<HbsTreeItem | null | undefined>();

	constructor(private workspaceRoot: string|undefined) {}

	enableRefresh = true;
	enableCollapseAll = true;
	toggleCollapseAll = true;

	readonly onDidChangeTreeData: vscode.Event<HbsTreeItem | null | undefined> = this.treeChangedEvent.event;

  refresh(): void {
    this.treeChangedEvent.fire();
  }

  getChildren(element?: HbsTreeItem): Thenable<HbsTreeItem[]> {
		var list = new Array<HbsTreeItem>();
		let curDir = element ? element.location : this.workingDir;
		var wsRoot = this.workspaceRoot ? this.workspaceRoot : curDir;
		
		// const cfg = vscode.workspace.getConfiguration(globals.extensionKey);
		// var contextFilter = cfg.get(globals.CfgContextFilter) ? /\.(hbs|handlebars)\.json/i : globals.DefaultContextFilter;

		if (curDir && wsRoot)
		{
			for (const file of this.getContextFiles(curDir, this.contextFilter)) {
				list.push(new HbsTreeItem(file.name, file.path, false, vscode.TreeItemCollapsibleState.None));
			}
			if (curDir != wsRoot) {
				let parts = curDir.split(path.sep);
				parts.pop();
				curDir = path.join(...parts);
				const dirDisplayName = wsRoot == curDir ? "ROOT" : path.relative(wsRoot, curDir);
				list.push(new HbsTreeItem(dirDisplayName, curDir, true, vscode.TreeItemCollapsibleState.Expanded));
			}
		}
		if (list.length == 0) {
			var helpItem = new HbsTreeItem('No HBS file selected', undefined, false, vscode.TreeItemCollapsibleState.None);
			helpItem.description = 'You need to open a .hbs file. This list will be populated by all .hbs.json files in the same or any parent directory up to the root/workspace directory.';
			helpItem.tooltip = helpItem.description;
			list.push(helpItem);
		}

		return Promise.resolve(list);
  }

  getTreeItem(element: HbsTreeItem): vscode.TreeItem {
		vscode.debug.activeDebugConsole.appendLine("Element selected = " + element.location);
		return element;
  }
	
	private *getContextFiles(dir:string, filter:RegExp = /\.(hbs|handlebars)\.json/i) {
		const dirents = fs.readdirSync(dir, { withFileTypes: true });
		for (const dirent of dirents) {
			const res = path.resolve(dir, dirent.name);
			var isMatch = filter.test(dirent.name);
			if (!dirent.isDirectory() && isMatch) {
				yield { name: dirent.name, path: res };
			}
		}
	}
}

export class HbsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public location: string|undefined,
		private isDir: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.location}`;
    this.description = this.location;
		this.contextValue = this.location ? this.isDir ? "folder" : "file" : "other";
  }

	/*
  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'directory.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'directory.svg')
  };
	*/
}