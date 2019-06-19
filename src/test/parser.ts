let hbs = `{{#>Partials/layout}}

  {{> header}}

  {{title}}
  {{author.name}}

  {{#each reviewer}}
	  {{this.firstName}}
	  {{./lastName}}
	  {{email}}

	  {{#each deepArray}}


	  {{/each}}
  {{/each}}

  {{signature}}
  
  {{#each otherthing}}
	  {{this.firstName}}
  {{/each}}

{{/Partials/layout}}`;

const arrayStack = [];

class EachScope {
	childScopes: EachScope[] = [];
	body = '';

	constructor() {
		this.parse();
	}

	private parse() {
		let nextStop: RegExpExecArray | null;

		while ((nextStop = /{{(#|\/)each/.exec(hbs)) !== null) {
			if (nextStop[1] === '/') {
				// Close the scope
				this.body = hbs.substring(0, nextStop.index);
				hbs = hbs.slice(nextStop.index + 1);
			} else {
				hbs = hbs.slice(nextStop.index + 1);
				this.childScopes.push(new EachScope());
			}
		}
	}
}

const scopes = new EachScope();

console.log(JSON.stringify(scopes, null, 2));




// Fortsätt traversera.
// Om vi hittar en #each, öka på stacken
// Om vi hittar en /each, avsluta scopet