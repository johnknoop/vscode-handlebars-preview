import { extractJson } from './extract-json';
import { Exception } from 'handlebars';

type ScopeType = 'root' | 'subscope';

interface Scope {
	identifier?: string;
	type: ScopeType;
	childScopes: ArrayScope[];
}

class ArrayScope implements Scope {
	body = '';
	childScopes: ArrayScope[] = [];
	endPosition?: number;

	constructor(hbs: string, type: 'root');
	constructor(hbs: string, type: 'subscope', identifier: string);

	constructor(private readonly hbs: string, readonly type: ScopeType, readonly identifier?: string) {
		this.scanScope();
	}

	private scanScope() {
		let nextChild: RegExpExecArray | null;

		let lastChildEndPosition: number = 0;

		while ((nextChild = /{{\s*#\s*each\s*([\w.]+).*?}}/.exec(this.hbs.slice(lastChildEndPosition))) !== null) {
			const [, childArrayName] = nextChild;

			// Append everything up until the start of the child to the body
			this.body = this.body + this.hbs.substring(lastChildEndPosition, nextChild.index);
			
			const childHbs = this.hbs.slice(nextChild.index + nextChild[0].length);
			const childArrayScope = new ArrayScope(childHbs, 'subscope', childArrayName.trim());
			this.childScopes.push(childArrayScope);
			
			lastChildEndPosition = nextChild.index + nextChild[0].length + childArrayScope.endPosition!;
			// Remove the child scopes body from the HBS
			//this.hbs = this.hbs.slice(nextChild.index + nextChild[0].length + childArrayScope.endPosition!);
		}

		if (this.type === 'root') {
			this.body = this.body + this.hbs.substr(lastChildEndPosition);
		} else {
			// Append everthing after the child to the body
			const postChildHbs = this.hbs.substring(lastChildEndPosition);
			const end = this.findClosingExpression(postChildHbs);
			this.body = this.body + end.body;
			this.endPosition = lastChildEndPosition + end.endPosition;
		}
	}

	private findClosingExpression(content: string) : { body: string; endPosition: number; } {
		const closer = content.match(/{{\s*\/\s*?each\s*?}}/);

		if (!closer || !closer.index) {
			throw new Exception("Array scope not closed (missing /each)");
		}

		return {
			body: content.substring(0, closer.index),
			endPosition: closer.index + closer[0].length
		};
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
		const childArrays = {};

		for (const childScope of scope.childScopes) {
			const tokens = childScope.identifier!.split('.');
			let currentScopeToPopulate = childArrays;

			tokens.forEach((prop, i) => {
				if (i < tokens.length - 1) {
					currentScopeToPopulate[prop] = {};
					currentScopeToPopulate = currentScopeToPopulate[prop];
				} else {
					currentScopeToPopulate[prop] = [{
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