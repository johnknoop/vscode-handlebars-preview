**How to use:**\
Open a Handlebars file, select **Handlebars: Preview** from the command menu **or** right click on the editor tab.

# Features

✅ Image support\
✅ [Automatically scans your workspace folder(s) for partials](#partials)\
✅ [Auto-refresh](#auto-refresh)\
✅ Generate context file from a template (experimental)

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
This feature is currently experimental. Arrays are not supported yet.