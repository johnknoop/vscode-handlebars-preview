import { extractJson } from "./extract-json";

interface Scope {
	type: 'root' | 'subscope'
	childScopes: ArrayScope[];
}

class ArrayScope implements Scope {
	protected body = '';
	childScopes: ArrayScope[] = [];

	constructor(hbs: string, type: 'root');
	constructor(hbs: string, type: 'subscope', identifier: string);

	constructor(private hbs: string, readonly type: 'root' | 'subscope', readonly identifier?: string) {
		this.scanScope();
	}

	private scanScope() {
		let nextStop: RegExpExecArray | null;

		while ((nextStop = /{{\s*(#|\/)\s*each\s*(\w+)?.*}}/.exec(this.hbs)) !== null) {
			const [, controlChar, arrayName] = nextStop;

			if (controlChar === '#') {
				// New scope
				this.body = this.body + this.hbs.substring(0, nextStop.index);
				this.hbs = this.hbs.slice(nextStop.index + 1);
				const nameOfNewChildScope = arrayName.trim();
				this.childScopes.push(new ArrayScope(this.hbs, 'subscope', nameOfNewChildScope));
			} else {
				// Close the scope
				this.body = this.body + this.hbs.substring(0, nextStop.index);
				this.hbs = this.hbs.slice(nextStop.index + 1);
				break;
			}
		}

		if (this.type === 'root') {
			this.body = this.body + this.hbs;
		}
	}

	getExpressions(): Object {
		return extractJson(this.body);
	}
}

class RootScope extends ArrayScope implements Scope {
	type: 'root' | 'subscope' = 'root';

	constructor(hbs) {
		super(hbs, 'root');
	}

	private getChildExpressions(scope: Scope) {
		const childArrays = {};

		for (const childScope of scope.childScopes) {
			childArrays[childScope.identifier!] = [{
				...childScope.getExpressions(),
				...this.getChildExpressions(childScope)
			}]
		}

		return childArrays;
	}

	getExpressions(): Object {
		const expressions = {
			...extractJson(this.body),
			...this.getChildExpressions(this)
		};

		return expressions;
	}
}

export default function(template: string): string {
	const root = new RootScope(template);

	return JSON.stringify(root.getExpressions(), null, 2);
}