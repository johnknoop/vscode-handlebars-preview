import * as path from "path";

export default function(filePath: string, workspaceRoot: string) {
	const extension = path.extname(filePath);
	return path.basename(filePath).slice(0, -extension.length);
}
