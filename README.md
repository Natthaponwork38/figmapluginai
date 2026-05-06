# Wireframe to Form v2.1.2

Figma plugin that converts wireframe images into ready-to-use form layouts by extracting fields with AI, then mapping each field to components in your selected reference frame.

## Major UI Upgrade

This version includes a major UI/UX upgrade aligned to a cleaner Figma plugin design style:

- Two-tab layout: `Generate` and `Configuration`
- Clear settings sections: `AI Settings (OpenAI Key)` and `Log Settings`
- Optional Google Sheet sync toggle (plugin can run without sync)
- Improved status messaging and setup guidance for non-technical users
- Persistent configuration values (OpenAI key and connector preferences)

## What This Plugin Does

- Accepts one or multiple wireframe images
- Sends each image to OpenAI Responses API for structured field extraction
- Generates Figma form frames from extracted schema
- Reuses your own design-system components from a selected reference frame
- Supports per-file retry, live processing status, and generation timing logs

## Core Features

- Stateful reference-frame selection from backend validation
- Batch processing with file-level states: waiting, processing, done, error
- JSON schema validation before generation
- Local generation log history and downloadable all-time log file with `Generate Type`
- Optional connector-based Google Sheet sync after each generation
- Auto-resizing plugin panel for smoother Figma workflow
- OpenAI API key persistence via `figma.clientStorage`

## Generation Log Fields

Each generation saves a log entry locally, and optionally syncs it to Google Sheet.

`Generate Type` is independent from Google Sheet sync. You can switch between `Production` and `Test` even when Google Sheet sync is OFF.

- `date`
- `time`
- `duration_sec`
- `success`
- `failed`
- `total`
- `generate_type` as `Production` or `Test`
- `timestamp`
- `source` when synced through the connector
- `remark` optional note from Generate screen, synced to Google Sheet

## Google Sheet Sync (Optional)

Google Sheet sync is optional and controlled in `Configuration`.

When sync is enabled:

1. Paste your Google Sheet link.
2. Share that Sheet with `n.pboat@gmail.com` as `Editor`.
3. Click `Connect`.
4. Logs are sent automatically after each generation.
5. If you turn sync OFF and later turn it ON again, click `Connect` again to re-confirm before syncing.

When sync is disabled:

- The plugin still works normally for generation.
- Logs are still stored locally in plugin storage.

Generation guard while sync is ON:

- If Google Sheet sync is ON but not connected, `Generate` is blocked until you click `Connect` successfully.

## Supported Field Types

The generator maps extracted fields to component names in your selected reference frame:

- `Input_Text`
- `Input_TextArea`
- `Input_Dropdown`
- `Input_Time`
- `Input_Calendar`
- `Input_DateRange`
- `Input_RadioButton`
- `Input_Upload`
- `Input_Checkbox`
- `Input_NumberRange`

## Project Structure

- [manifest.json](manifest.json): plugin metadata and entry points
- [code.js](code.js): Figma runtime logic (selection, generation, storage, connector messaging)
- [ui.html](ui.html): plugin UI, API calls, generation workflow, and config states

## Local Development (Figma)

1. Open Figma Desktop.
2. Go to `Plugins` > `Development` > `Import plugin from manifest`.
3. Select [manifest.json](manifest.json).
4. Run `Wireframe to Form v2.1.2` from Development plugins.

## How To Use

1. Open `Configuration` tab.
2. Enter OpenAI API key in `AI Settings (OpenAI Key)`.
3. (Optional) Enable Google Sheet log sync and connect your Sheet.
4. Go to `Generate` tab.
5. Use the `Generate Type` toggle: Turn ON = `Production`, Turn OFF = `Test`.
6. Select a reference frame containing components named with supported keys.
7. Upload one or more wireframe images.
8. Click `Generate`.
9. Output is created under the `AI Generated Forms` frame.

## Security Notes

- Do not hardcode credentials in source files.
- OpenAI API key is stored locally in plugin storage (`figma.clientStorage`).
- Keep repository clean from secrets using [.gitignore](.gitignore).

## Troubleshooting

- `Please select reference frame`:
Select exactly one Figma `FRAME` before generating.
- Connect fails for Google Sheet sync:
Ensure the Sheet is shared with `n.pboat@gmail.com` as `Editor`.
- Empty/invalid AI response:
Retry the failed file from the file action row.
- Missing components in output:
Verify component names in the reference frame match supported field types.

## Version

Current plugin title: `Wireframe to Form v2.1.2`

## Latest Updates

- `v2.1.2` Improved Dropdown value handling to follow Text behavior, added startup compatibility fix for unsupported optional-chaining syntax, and preserved placeholder behavior for empty Dropdown fields.
- `v2.1.1` Fixed file intake workflow: click now appends instead of replacing, drag/drop and paste image are supported, duplicates are skipped, and file list stays sorted by filename.
- `v2.1.0` Standardized Latest Updates format to show release versions on each entry.
- `v2.0.9` Generated output now appears below the selected reference frame instead of canvas origin.
- `v2.0.8` Fixed radio button checked-state mapping from wireframe images.
- `v2.0.7` Fixed checkbox checked-state mapping from wireframe images.
- `v2.0.6` Added optional Remark field on the Generate tab and included it in generation logs.
- `v2.0.5` Improved Google Sheet sync reliability with retry and exponential backoff.
- `v2.0.5` Added pending-log recovery so unsent logs can flush after reconnecting.
- `v2.0.4` Excluded upload-internal buttons such as `Browse...` and `เลือกไฟล์` from standalone button generation.
- `v2.0.3` Added support for button text placeholders named `{Button}` or `Button`.

