let hbs = `{{#>Partials/layout}}

  {{> header}}

  {{title}}
  {{author.name}}

  {{#each reviewer}}				1
	  {{this.firstName}}
	  {{./lastName}}
	  {{email}}

	  {{#each deepArray}}			2

			{{ banana }}
	  {{/each}}
  {{/each}}

  {{signature}}
  
  {{#each otherthing}}				3
	  {{this.firstName}}
  {{/each}}

{{/Partials/layout}}`;

const arrayStack = [];

class ArrayScope {
	childScopes: ArrayScope[] = [];
	body = '';

	constructor(private readonly arrayName: string) {
		this.extractChildScopes();
	}

	private extractChildScopes() {
		let nextStop: RegExpExecArray | null;

		while ((nextStop = /{{(#|\/)each( \w+)?.*}}/.exec(hbs)) !== null) {
			if (nextStop[1] === '#') {
				// New scope
				this.body = hbs.substring(0, nextStop.index);
				hbs = hbs.slice(nextStop.index + 1);
				this.childScopes.push(new ArrayScope(nextStop[2]));
			} else {
				// Close the scope
				this.body = hbs.substring(0, nextStop.index);
				hbs = hbs.slice(nextStop.index + 1);
			}
		}
	}
}

const scopes = new ArrayScope('');

console.log(JSON.stringify(scopes, null, 2));




// Fortsätt traversera.
// Om vi hittar en #each, öka på stacken
// Om vi hittar en /each, avsluta scopet