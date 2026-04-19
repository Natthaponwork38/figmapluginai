# AI Gen Form v1.0

Figma plugin that converts wireframe screenshots into form components by using AI field extraction and mapping each detected field to components inside a selected reference frame.

## What This Plugin Does

- Accepts one or multiple reference images (wireframes)
- Sends each image to OpenAI Responses API for structured field extraction
- Generates Figma frames from the extracted schema
- Reuses your design-system components from a selected reference frame
- Supports retry per failed file and live processing status

## Core Features

- Real selection validation:
	The Select Reference Frame button is now stateful from backend confirmation, not click-only UI state.
	- Green: frame selection confirmed
	- Red: selection invalid or missing
- Batch image processing with per-file status
- Dynamic plugin height resize for cleaner Figma panel behavior
- JSON response validation before generation
- Improved error diagnostics for API and parsing failures

## Supported Field Types

The generator maps extracted fields to component names in your selected reference frame.

- Input_Text
- Input_TextArea
- Input_Dropdown
- Input_Time
- Input_Calendar
- Input_DateRange
- Input_RadioButton
- Input_Upload
- Input_Checkbox
- Input_NumberRange

## Project Structure

- [manifest.json](manifest.json): plugin metadata and entry points
- [code.js](code.js): Figma runtime logic (selection, generation, component mapping)
- [ui.html](ui.html): plugin UI, upload flow, API calls, and progress states

## Local Development (Figma)

1. Open Figma Desktop.
2. Go to Plugins > Development > Import plugin from manifest.
3. Select [manifest.json](manifest.json) from this repository.
4. Run AI Gen Form v1.0 from Development plugins.

## How To Use

1. Prepare a reference frame in your Figma file.
2. Make sure the frame contains components named with supported type keys (for example Input_Text, Input_Upload).
3. Click Select Reference Frame.
4. Confirm the button turns green (valid selection).
5. Enter your OpenAI API key.
6. Upload wireframe image(s).
7. Click Generate.
8. Generated output appears under AI Generated Forms frame.

## Security Notes

- Do not hardcode API keys in source files.
- Use the runtime input field for API key only.
- Keep local secret files out of Git via [.gitignore](.gitignore).

## Troubleshooting

- Button stays red after Select Reference Frame:
	Select exactly one node and ensure it is a Figma FRAME.
- Generation says no reference frame selected:
	Re-select the frame (it may have been removed or changed).
- Invalid JSON or empty response:
	Retry the file from the failed item action.
- Components are missing in generated result:
	Verify component names in your reference frame match supported type keys.

## Version

Current plugin title: AI Gen Form v1.0

