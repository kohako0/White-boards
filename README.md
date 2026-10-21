# Freiraum — Your Local Whiteboards

A creative space for ideas, sketches, and images. With **Freiraum**, you can create whiteboards in your browser and save them directly to your computer — without an account, cloud storage, or external dependencies.

## Features

- **Multiple whiteboards:** Create, name, search, sort, and reopen boards.
- **Automatic saving:** Changes are saved as local JSON files, with the save status visible in the editor.
- **Drawing:** Freehand pen with various colors and stroke widths, plus an eraser that removes entire objects.
- **Text and notes:** Freely position text and colored sticky notes, editable directly on the canvas with a single click — no dialog windows.
- **Clean lines:** Optional pen stabilization smooths curves and straightens nearly straight strokes. A dedicated line tool draws exact straight lines; hold Shift to snap to 45-degree increments.
- **Shapes:** Rectangles, ellipses, and arrows, optionally with filled areas.
- **Images:** Import PNG, JPEG, WebP, and GIF files via the file picker, drag and drop, or clipboard.
- **Object editing:** Select, move, duplicate, bring to front, and delete objects; resize images, shapes, and sticky notes.
- **Navigation:** Large canvas with zoom and panning using the hand tool.
- **Undo and redo:** Undo or restore editing steps within the currently open board.
- **Export and import:** Export boards as PNG images or save and reimport them as editable JSON files.

## Quick Start

### Requirements

- Node.js version **18** or later
- A modern browser

Download the repository as a ZIP file and extract it, or clone it using Git. Then open a terminal in the project directory:

```sh
npm start
```

Next, open the app in your browser:

**[http://127.0.0.1:4317](http://127.0.0.1:4317)**

No `npm install` or build step is required. Once the project has been downloaded, the app works offline.

### Windows: Launch with a Double-Click

Double-click **`Start.cmd`**. The launcher opens the app in your default browser and starts the local server in the background if necessary. If a Freiraum instance is already running on port `4317`, it will be reused.

The background server remains active after closing the browser. Restarting Windows terminates it. When starting the app with `npm start`, you can stop the server in the terminal by pressing **Ctrl + C**.

## Usage

1. Click **New Whiteboard** on the overview screen and enter a name at the top.
2. Select a tool from the top toolbar. Click the canvas and start typing to add text or sticky notes; click and drag to draw or create shapes.
3. Adjust colors, stroke width, and text size in the style panel.
4. Import images using the image icon, drag them onto the canvas, or paste them from the clipboard.
5. Click existing text or a sticky note with the selection tool to edit it directly. Drag to move it instead. Enter inserts a new line; click outside, press Esc, or use Ctrl + Enter to finish. Use the corner handles to resize images, shapes, and sticky notes.
6. Before closing the app, wait until **Saved** appears or click **Save**.

The **Linienkorrektur** checkbox in the style panel controls pen stabilization. It is enabled by default and the preference is remembered in your browser. Existing drawings remain unchanged when toggling it.

Images maintain their aspect ratio when resized. Hold **Shift** to adjust width and height independently. The eraser removes an entire object at a time.

### Keyboard Shortcuts

Tool shortcuts work outside input fields.

| Key | Action |
| --- | --- |
| `V` | Selection tool |
| `H` | Hand tool |
| `P` | Pen |
| `L` | Straight line |
| `Shift` while drawing | Straighten a pen stroke or snap a line to 45-degree increments |
| `E` | Object eraser |
| `T` | Text |
| `N` | Sticky note |
| `R` | Rectangle |
| `O` | Ellipse |
| `A` | Arrow |
| `Space` + drag | Pan the canvas |
| Mouse wheel | Zoom toward the cursor |
| Click text or sticky note | Edit directly on the canvas |
| `Esc` / `Ctrl + Enter` while typing | Finish editing |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` or `Ctrl + Shift + Z` | Redo |
| `Ctrl + D` | Duplicate selected object |
| `Delete` or `Backspace` | Delete selected object |
| Arrow keys | Move selected object |
| `Shift` + arrow keys | Move selected object in larger increments |
| `Ctrl + S` | Save immediately |
| `Ctrl + V` | Paste image from clipboard |
| `Esc` | Clear selection |

On macOS, `Cmd` can be used instead of `Ctrl` for the corresponding shortcuts. The double-click launcher is designed for Windows; on other systems, start the app using `npm start`.

## Storage and Backups

The app automatically creates a `boards/` subdirectory in the project folder. Each whiteboard is stored as a separate JSON file. Imported images are embedded directly in these files.

- Changes are saved after a short delay of approximately **0.7 seconds**.
- Data persists when the browser is reloaded and is independent of the browser cache.
- Back up the `boards/` directory or export individual boards as JSON files.
- A JSON export can be imported as a new board using the import button on the overview screen.
- A PNG export contains the visible result as an image. Use JSON format to preserve all objects for further editing and backup.
- Deleting a board from the overview permanently removes its file after confirmation.

The `boards/` directory is listed in `.gitignore` so that personal whiteboards are not accidentally published during normal Git operations.

## Technical Architecture

Freiraum uses **HTML, CSS, and vanilla JavaScript** for the interface, **SVG** for the drawing canvas, and the built-in modules of **Node.js** for the local HTTP server and file storage. There are no external runtime dependencies.

```text
.
├── public/
│   ├── index.html        # Interface and dialogs
│   ├── style.css         # Layout and responsive design
│   ├── stroke.js         # Pen smoothing, straightening and angle snapping
│   ├── app.js            # Drawing tools, editor, and exports
│   └── favicon.svg
├── test/
│   ├── editor.test.js     # Direct-editing and drawing interaction tests
│   ├── stroke.test.js     # Smoothing and angle snapping tests
│   └── server.test.js    # Automated server and storage tests
├── boards/               # Personal board files; created automatically
├── server.js             # Local HTTP server and board API
├── launch.js             # Windows launcher with browser opening
├── Start.cmd             # Double-click launcher for Windows
├── package.json
├── .gitignore
└── README.md
```

The server listens exclusively on `127.0.0.1`. The app is designed for local use by a single person. User accounts, cloud synchronization, and real-time collaborative editing are not included.

A Node.js server is required to run the app. Static hosting services such as GitHub Pages do not provide the storage API.

### Configuration

When starting the server directly, the following environment variables are supported:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4317` | Port for the local HTTP server |
| `WHITEBOARD_DATA_DIR` | `boards/` in the project directory | Storage directory for board files |

Example in PowerShell:

```powershell
$env:PORT = '4320'
$env:WHITEBOARD_DATA_DIR = 'D:\MeineWhiteboards'
npm start
```

In this example, the app is available at `http://127.0.0.1:4320`. `Start.cmd` and `launch.js` use the fixed default address on port `4317`. To use a custom port, start the app directly with `npm start`.

### Tests

```sh
npm test
```

The tests verify board creation, saving, loading, overwriting, and deletion; validation of invalid content; access control for requests from external web origins; and delivery of app files. Test data is stored separately from personal boards.

## Limitations

| Area | Limit or behavior |
| --- | --- |
| Image import | Maximum 20 MB per image |
| Large images | Resized to a maximum dimension of 2,200 pixels |
| Animated GIFs | Imported as static images |
| Board file / storage request | Maximum 50 MB, including embedded images |
| Elements per board | Maximum 10,000 |
| PNG export | Maximum dimension of 6,000 pixels |
| Undo history | Limited to the currently open editing session |

## Frequently Asked Questions

**The app won't start.**

Run `node --version` to check whether Node.js is installed and accessible from the terminal. Then run `npm start` in the project directory to see any error messages. The selected port must be available.

**The app displays "Not saved."**

Check whether the local server is running and whether the storage directory is writable. Click **Save** again and close the app only after **Saved** appears.

**Can I transfer my boards to another computer?**

Yes. Copy the `boards/` directory into the Freiraum installation on the other computer, or export the desired boards as JSON files and import them on the other computer.
The editor interaction tests also cover direct text editing, moving and growing sticky notes, straight-line drawing, and undo/redo. Geometry tests cover pen stabilization, curve preservation, short strokes, and zoom-dependent correction.
