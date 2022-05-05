import { generatePartialNames } from '../src/partial-name-generator';

it('Should abbreviate templates in "partials" folder', () => {
	const result = generatePartialNames([
		{ filePath: 'c:\\root\\partials\\header.hbs', workspaceRoot: 'c:\\root' },
		{ filePath: 'c:\\root\\partials\\footer.hbs', workspaceRoot: 'c:\\root' },
		{ filePath: 'c:\\root\\templates\\hello.hbs', workspaceRoot: 'c:\\root' },
		{ filePath: 'c:\\root\\templates\\world.hbs', workspaceRoot: 'c:\\root' },
	])

	expect(result).toStrictEqual([
		{ registeredName: 'partials/header', filePath: 'c:\\root\\partials\\header.hbs' },
		{ registeredName: 'partials/footer', filePath: 'c:\\root\\partials\\footer.hbs' },
		{ registeredName: 'templates/hello', filePath: 'c:\\root\\templates\\hello.hbs' },
		{ registeredName: 'templates/world', filePath: 'c:\\root\\templates\\world.hbs' },
		{ registeredName: 'header', filePath: 'c:\\root\\partials\\header.hbs' },
		{ registeredName: 'footer', filePath: 'c:\\root\\partials\\footer.hbs' },
	]);
});

it('Templates outside "partials" folder should have precedence over abbreviated ones', () => {
	const result = generatePartialNames([
		{ filePath: 'c:\\root\\partials\\header.hbs', workspaceRoot: 'c:\\root' },
		{ filePath: 'c:\\root\\hello.hbs', workspaceRoot: 'c:\\root' },
		{ filePath: 'c:\\root\\header.hbs', workspaceRoot: 'c:\\root' },
	])

	expect(result).toStrictEqual([
		{ registeredName: 'partials/header', filePath: 'c:\\root\\partials\\header.hbs' },
		{ registeredName: 'hello', filePath: 'c:\\root\\hello.hbs' },
		{ registeredName: 'header', filePath: 'c:\\root\\header.hbs' },
	]);
});