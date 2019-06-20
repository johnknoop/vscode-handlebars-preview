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
	'age', 'number', 'length', 'height', 'width', 'size',
	'index', 'order', 'ordinal'
];

function tryNumeric(fieldName: string): boolean {
	return numericTells.some(x => fieldName.endsWith(x));
}

function tryBoolean(fieldName: string): boolean {
	if (!fieldName.startsWith('is') && !fieldName.startsWith('has')) {
		return false
	}

	const nextChar = fieldName.replace(/(is|has)/, '')[0];

	if (nextChar && nextChar == nextChar.toUpperCase()) {
		return true;
	}

	return false;
}

const firstNameTells = ['firstname', 'first_name', 'name', 'author']
const lastNameTells = ['lastname', 'surname', 'familyname', 'last_name'];
const cityTells = ['city', 'town'];
const countryTells = ['country', 'land'];
const colorTells = ['color', 'colour'];

function getStringSample(fieldName: string): string {
	if (firstNameTells.some(x => fieldName.includes(x))) {
		return 'Obi-Wan';
	}

	if (lastNameTells.some(x => fieldName.includes(x))) {
		return 'Kenobi';
	}

	if (cityTells.some(x => fieldName.includes(x))) {
		return 'Chicago';
	}

	if (countryTells.some(x => fieldName.includes(x))) {
		return 'Japan';
	}

	if (colorTells.some(x => fieldName.includes(x))) {
		return 'blue';
	}

	return '';
}