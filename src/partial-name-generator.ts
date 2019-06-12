import * as path from "path";

export default function(filePath: string, workspaceRoot: string) {
	const extension = path.extname(filePath);
	const relativePath = path.relative(workspaceRoot, filePath);
	return relativePath.slice(0, -extension.length).replace(/\\/g, '/').replace(/[^A-Za-z0-9/]/g, '-');
}