**How to use:**\
Open a Handlebars file, select **Handlebars: Preview** from the command menu **or** right click on the editor tab.

# Features

✅ Image support\
✅ [Automatically scans your workspace folder(s) for partials and helpers](#partials)\
✅ [Auto-refresh](#auto-refresh)\
✅ [Generate context file from a template](#generate-context-file-from-template)

## Partials
Partials are automatically discovered and given names based off of the workspace folder root. So if these are the subfolders of the folder you've opened in VS Code:
```
.
└── 📁partials
    ├── 📁style
    │    └── dark.hbs
    └── footer.hbs
```
Then the two partials will be registered as `partials/footer` and `partials/style/dark` respectively.

## Helpers
Helpers can be defined as javascript modules and will be automatically discovered and registered. Helpers can be placed anywhere in the Workspace, as long as they use the double file extentions like: `.hbs.js` or `.handlebars.js`.
   
As an example, a typical helper file could look like this:
```js
// my_helpers.handlebars.js

module.exports = {
    toUpperCase: function (text) {
        return text.toUpperCase();
    },
    toLowerCase: function (text) {
        return text.toLowerCase();
    }
};
```
And could be used like this inside your Handlebars template like this:

```hbs
{{toUpperCase title}}
```

## Auto-refresh
Changes to Handlebars templates applied in real-time. Included partials need to be saved in order for the change to take effect.

## Generate context file from template
Right-click on a handlebars file in the sidebar or on the editor tab and select **Handlebars: Generate context file**.

A new file named `{yourfile}.json` will be created and populated with sample data.

> #### Current limitations of context generation:
> 🙁 [Block parameters](https://handlebarsjs.com/guide/block-helpers.html#block-parameters) in `each`-constructs are not supported\
> 🙁 Path segments (`../`) are currently not supported.
> 
> If you're using any of these features in your template, the resulting json will need some manual fixing.
> 
> Feel free to make a pull request if these limitations are bothering you.

# Report an issue

Found a problem or have a feature request? Please post an issue over at our GitHub repository:\
https://github.com/johnknoop/vscode-handlebars-preview/issues

# 2.0 roadmap


📍 Override naming of partials using workspace-configuration\
📍 Intellisense suggestions for partials and context data
📍 Ctrl+click navigation to partials

See https://github.com/johnknoop/vscode-handlebars-preview/milestone/1 for more details
