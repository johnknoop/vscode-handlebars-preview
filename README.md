**How to use:**\
Open a Handlebars file, select **Handlebars: Preview** from the command menu **or** right click on the editor tab.

# Features

✅ Image support\
✅ [Automatically scans your workspace folder(s) for partials](#partials)\
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

## Auto-refresh
Changes to Handlebars templates applied in real-time. Included partials need to be saved in order for the change to take effect.

## Generate context file from template
Right-click on a handlebars file in the sidebar or on the editor tab and select **Handlebars: Generate context file**.

A new file named _{yourfile}_.json will be created and populated with sample data.

#### Current limitations of context generation:
🙁 [Block parameters](https://handlebarsjs.com/block_helpers.html#block-params) in `each`-constructs are not supported\
🙁 Path segments (`../`) are currently not supported.

If you're using any of these features in your template, the resulting json will need some manual fixing.

# Roadmap

📍 Override naming of partials using workspace-configuration