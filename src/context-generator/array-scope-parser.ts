import { extractJson } from "./extract-json";

type ScopeType = 'root' | 'subscope';

interface Scope {
	identifier?: string;
	type: ScopeType
	childScopes: ArrayScope[];
}

export class ArrayScope implements Scope {
	protected body = '';
	childScopes: ArrayScope[] = [];

	constructor(hbs: string, type: 'root');
	constructor(hbs: string, type: 'subscope', identifier: string);

	constructor(private hbs: string, readonly type: ScopeType, readonly identifier?: string) {
		this.scanScope();
	}

	private scanScope() {
		let nextStop: RegExpExecArray | null;

		while ((nextStop = /{{\s*(#|\/)\s*each\s*([\w.]+)?.*}}/.exec(this.hbs)) !== null) {
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

export class RootScope extends ArrayScope implements Scope {
	type = 'root' as ScopeType;

	constructor(hbs) {
		super(hbs, 'root');
	}

	private getChildExpressions(scope: Scope) {
		let childArrays = {};

		for (const childScope of scope.childScopes) {
			const tokens = childScope.identifier!.split('.');

			tokens.forEach((prop, i) => {
				if (i < tokens.length - 1) {
					childArrays[prop] = {};
					childArrays = childArrays[prop];
				} else {
					childArrays[prop] = [{
						...childScope.getExpressions(),
						...this.getChildExpressions(childScope)
					}];
				}
			})
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

export function extractArrayScopes(template: string): Object {
	const root = new RootScope(template);
	return root.getExpressions();
}