type DataTypeResult = {
	success: boolean;

}

/**
 * Generates sample data based on descriptor.
 * @param fieldName A (trimmed) descriptor of the data
 */
export default function (fieldName: string): number | boolean | string {
	if (tryBoolean(fieldName)) {
		return false;
	}

	if (tryNumeric(fieldName)) {
		return 10;
	}

	return getStringSample(fieldName);
}

const numericTells = [
	'(?<!mess)age', 'number', 'length', 'height', 'width', 'size',
	'index', 'order', 'ordinal', 'quantity', 'id'
];

function tryNumeric(fieldName: string): boolean {
	return numericTells.some(x => fieldName.match(new RegExp(`${x}$`, 'i')));
}

function tryBoolean(fieldName: string): boolean {
	if (!fieldName.toLowerCase().startsWith('is') && !fieldName.toLowerCase().startsWith('has')) {
		return false
	}

	const nextChar = fieldName.replace(/(is|has)/, '')[0];

	if (nextChar && nextChar == nextChar.toUpperCase()) {
		return true;
	}

	return false;
}

const lastNameTells = ['lastname', 'surname', 'familyname', 'last_name'];
const firstNameTells = ['firstname', 'first_name', 'name', 'author']
const cityTells = ['city', 'town'];
const countryTells = ['country', 'land'];
const colorTells = ['color', 'colour'];
const emailTells = ['email', 'e_mail', 'mail', 'emailaddress', 'mailaddress',
						'mail_address', 'email_address'];

const countries = ['Sweden', 'Japan', 'Italy', 'Brazil'];
const cities = ['Chicago', 'Gothenburg', 'Kairo', 'Sidney'];
const firstNames = ['Obi-Wan', 'Rey', 'Aragorn', 'Mary'];
const lastNames = ['Kenobi', 'Higginbottom', 'Smith', 'Anderson'];
const colors = ['blue', 'green', 'red', 'orange'];
const domainNames = ['example.com', 'example.net', 'example.org'];

function getStringSample(fieldName: string): string {
	const normalizedFieldName = fieldName.toLowerCase();

	if (lastNameTells.some(x => normalizedFieldName.includes(x))) {
		return lastNames[Math.floor(Math.random() * lastNames.length)];
	}
	
	if (firstNameTells.some(x => normalizedFieldName.includes(x))) {
		return firstNames[Math.floor(Math.random() * firstNames.length)];
	}

	if (cityTells.some(x => normalizedFieldName.includes(x))) {
		return cities[Math.floor(Math.random() * cities.length)];
	}

	if (countryTells.some(x => normalizedFieldName.includes(x))) {
		return countries[Math.floor(Math.random() * countries.length)];
	}

	if (colorTells.some(x => normalizedFieldName.includes(x))) {
		return colors[Math.floor(Math.random() * colors.length)];
	}

	if (emailTells.some(x => normalizedFieldName.includes(x))) {
		const domain = domainNames[Math.floor(Math.random() * domainNames.length)];
		const name = firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase().replace(/\W/g, '-');

		return `${name}@${domain}`;
	}

	return '';
}