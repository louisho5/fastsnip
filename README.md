# FastSnip

A simple OCR screen capture tool I built for Windows. Basically lets you grab text from anywhere on your screen with a quick hotkey.

## Why I built this

I was looking for something like TextSniper (which is Mac-only) for Windows but couldn't find any good free alternatives. So I decided to build one myself for everyone who needs it.

## What it does

- Press `Ctrl+Shift+T` to capture any area and extract text
- Works with multiple languages (English, Chinese, Japanese, Korean, etc.)
- Sits in your system tray, stays out of the way
- Copy extracted text with one click
- No installation needed - just download and run

## How to use it

1. Download and run `FastSnip.exe` 
2. Press `Ctrl+Shift+T` anywhere to capture
3. Drag to select text area
4. Copy the extracted text

Right-click the system tray icon to change language settings.

## Development

Want to build it yourself?

```bash
git clone https://github.com/louisho5/fastsnip.git
cd fastsnip
npm install
npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project uses the following third-party libraries:

**Electron**
- License: MIT License
- Copyright: GitHub Inc.
- Source: https://github.com/electron/electron

**Tesseract.js**
- License: Apache License 2.0
- Copyright: Tesseract.js contributors
- Source: https://github.com/naptha/tesseract.js
- License text: https://www.apache.org/licenses/LICENSE-2.0