const { app, BrowserWindow, ipcMain, desktopCapturer, screen, clipboard, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;
let captureWindow;
let tray = null;
let currentLanguage = 'auto'; // Default language setting
let isCapturing = false; // Flag to prevent multiple captures
let options = {
    width: 340,
    height: 265,
    title: "FastSnip",
    resizable: true,
    frame: false, // Remove default frame for custom titlebar
    titleBarStyle: 'hidden',
    maximizable: false, // Disable fullscreen button
	transparent: false,
	webPreferences: {
		nodeIntegration: false,
		contextIsolation: true,
		preload: path.join(__dirname, 'preload.js'),
	}
}

app.on('ready', () => {
    //init functions
    createMainWindow();
    createTray();
    registerGlobalShortcuts();
	
    //load offline website
    mainWindow.loadFile('./web/index.html');

	ipcMain.on('start-capture', async (event) => {
		await startScreenCapture();
	});

	ipcMain.on('capture-area', async (event, bounds) => {
		await captureSelectedArea(bounds);
	});

	ipcMain.on('cancel-capture', (event) => {
		if (captureWindow && !captureWindow.isDestroyed()) {
			captureWindow.close();
			captureWindow = null;
		}
		isCapturing = false; // Reset flag when cancelled
	});

	ipcMain.on('get-language-setting', (event) => {
		event.reply('language-setting', currentLanguage);
	});

	// Window control handlers
	ipcMain.on('window-minimize', () => {
		mainWindow.minimize();
	});

	ipcMain.on('window-close', () => {
		mainWindow.close();
	});
	
});

async function startScreenCapture() {
	try {
		// Prevent multiple simultaneous captures
		if (isCapturing) {
			console.log('Capture already in progress, ignoring request');
			return;
		}
		
		isCapturing = true;
		
		// Prevent multiple capture windows - close existing one first
		if (captureWindow && !captureWindow.isDestroyed()) {
			captureWindow.close();
			captureWindow = null;
		}
		
		// Get all displays
		const displays = screen.getAllDisplays();
		const primaryDisplay = screen.getPrimaryDisplay();
		
		// Create capture window covering all screens
		captureWindow = new BrowserWindow({
			width: primaryDisplay.bounds.width,
			height: primaryDisplay.bounds.height,
			x: primaryDisplay.bounds.x,
			y: primaryDisplay.bounds.y,
			transparent: false,
			frame: false,
			alwaysOnTop: true,
			skipTaskbar: true,
			show: false,
			backgroundColor: '#000000',
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				preload: path.join(__dirname, 'preload.js')
			}
		});

		// Handle capture window close event
		captureWindow.on('closed', () => {
			captureWindow = null;
			isCapturing = false; // Reset flag when window closes
		});

		// Get screenshot of entire screen first
		const sources = await desktopCapturer.getSources({
			types: ['screen'],
			thumbnailSize: {
				width: primaryDisplay.bounds.width,
				height: primaryDisplay.bounds.height
			}
		});

		if (sources.length > 0) {
			const screenshot = sources[0].thumbnail.toDataURL();
			
			// Load capture interface and wait for it to be ready
			await captureWindow.loadFile('./web/capture.html');
			
			// Wait a brief moment for the page to fully load
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Send screenshot data and show window
			captureWindow.webContents.send('screenshot-ready', screenshot);
			captureWindow.show();
			captureWindow.focus();
		} else {
			// If no screenshot available, just show the capture window
			await captureWindow.loadFile('./web/capture.html');
			captureWindow.show();
			captureWindow.focus();
		}
	} catch (error) {
		console.error('Screen capture error:', error);
		isCapturing = false; // Reset flag on error
	}
}

async function captureSelectedArea(bounds) {
	try {
		// Get screenshot again for processing
		const sources = await desktopCapturer.getSources({
			types: ['screen'],
			thumbnailSize: {
				width: screen.getPrimaryDisplay().bounds.width,
				height: screen.getPrimaryDisplay().bounds.height
			}
		});

		if (sources.length > 0) {
			const screenshot = sources[0].thumbnail;
			
			// Crop the image to selected area
			const canvas = require('electron').nativeImage.createFromBuffer(screenshot.toPNG());
			const croppedImage = canvas.crop({
				x: Math.round(bounds.x),
				y: Math.round(bounds.y),
				width: Math.round(bounds.width),
				height: Math.round(bounds.height)
			});

			// Convert cropped image to base64 data URL instead of saving to file
			const imageBuffer = croppedImage.toPNG();
			const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;

			// Show main window automatically after successful capture
			if (!mainWindow.isVisible()) {
				mainWindow.show();
			}
			
			// Set window to topmost and focus
			mainWindow.setAlwaysOnTop(true);
			mainWindow.focus();
			mainWindow.moveTop();
			
			// Remove topmost after a short delay to allow normal window behavior
			setTimeout(() => {
				mainWindow.setAlwaysOnTop(false);
			}, 1000);

			// Send base64 data to renderer for OCR processing
			mainWindow.webContents.send('process-ocr', base64Data);
		}

		// Close capture window with proper cleanup
		if (captureWindow && !captureWindow.isDestroyed()) {
			captureWindow.close();
			captureWindow = null;
		}
		
		// Reset capturing flag
		isCapturing = false;
	} catch (error) {
		console.error('Area capture error:', error);
		isCapturing = false; // Reset flag on error
	}
}

function createMainWindow() {
	mainWindow = new BrowserWindow(options);
	mainWindow.setMenuBarVisibility(false);
	
	// Custom close behavior with confirmation
	mainWindow.on('close', (event) => {
		if (!app.isQuiting) {
			event.preventDefault();
			
			// Show dialog asking user preference
			const { dialog } = require('electron');
			const choice = dialog.showMessageBoxSync(mainWindow, {
				type: 'question',
				buttons: ['Minimize to Tray', 'Close Application', 'Cancel'],
				defaultId: 0,
				title: 'FastSnip',
				message: 'What would you like to do?',
				detail: 'FastSnip can minimize to system tray to stay running in the background.'
			});
			
			if (choice === 0) {
				// Minimize to tray
				mainWindow.hide();
			} else if (choice === 1) {
				// Close application - proper cleanup and quit
				app.isQuiting = true;
				
				// Clean up capture window if it exists
				if (captureWindow && !captureWindow.isDestroyed()) {
					captureWindow.close();
					captureWindow = null;
				}
				
				// Unregister global shortcuts
				globalShortcut.unregisterAll();
				
				// Destroy tray
				if (tray) {
					tray.destroy();
					tray = null;
				}
				
				// Force quit the app
				app.quit();
				
				// If app.quit() doesn't work, force exit
				setTimeout(() => {
					process.exit(0);
				}, 1000);
			}
			// choice === 2 is cancel, do nothing
			
			return false;
		}
	});
}

function createTray() {
	// Create tray icon (you can replace this with a proper icon file)
	const icon = nativeImage.createFromPath(path.join(__dirname, 'favicon.ico'));
	tray = new Tray(icon.resize({ width: 16, height: 16 }));
	
	// Create context menu
	updateTrayMenu();
	
	tray.setToolTip('FastSnip - OCR Screen Capture');
	
	// Double click to show main window
	tray.on('double-click', () => {
		if (mainWindow.isVisible()) {
			mainWindow.hide();
		} else {
			mainWindow.show();
		}
	});
}

function updateTrayMenu() {
	const contextMenu = Menu.buildFromTemplate([
		{
			label: '📸 Quick Capture (Ctrl+Shift+T)',
			click: () => {
				startScreenCapture();
			}
		},
		{ type: 'separator' },

		{
			label: 'Language Settings',
			submenu: [
				{
					label: '🌐 Auto Detect (Multi-language)',
					type: 'radio',
					checked: currentLanguage === 'auto',
					click: () => setLanguage('auto')
				},
				{
					label: '🇺🇸 English',
					type: 'radio',
					checked: currentLanguage === 'eng',
					click: () => setLanguage('eng')
				},
				{
					label: '🇹🇼 Traditional Chinese',
					type: 'radio',
					checked: currentLanguage === 'chi_tra',
					click: () => setLanguage('chi_tra')
				},
				{
					label: '🇨🇳 Simplified Chinese',
				 type: 'radio',
					checked: currentLanguage === 'chi_sim',
					click: () => setLanguage('chi_sim')
				},
				{
					label: '🇯🇵 Japanese',
					type: 'radio',
					checked: currentLanguage === 'jpn',
					click: () => setLanguage('jpn')
				},
				{
					label: '🇰🇷 Korean',
					type: 'radio',
					checked: currentLanguage === 'kor',
					click: () => setLanguage('kor')
				},
				{
					label: '🇫🇷 French',
					type: 'radio',
					checked: currentLanguage === 'fra',
					click: () => setLanguage('fra')
				},
				{
					label: '🇩🇪 German',
					type: 'radio',
					checked: currentLanguage === 'deu',
					click: () => setLanguage('deu')
				},
				{
					label: '🇪🇸 Spanish',
					type: 'radio',
					checked: currentLanguage === 'spa',
					click: () => setLanguage('spa')
				},
				{
					label: '🇷🇺 Russian',
					type: 'radio',
					checked: currentLanguage === 'rus',
					click: () => setLanguage('rus')
				},
				{
					label: '🇸🇦 Arabic',
					type: 'radio',
					checked: currentLanguage === 'ara',
					click: () => setLanguage('ara')
				}
			]
		},
		{ type: 'separator' },
		{
			label: 'Show Main Window',
			click: () => {
				mainWindow.show();
			}
		},
		{
			label: 'Quit FastSnip',
			click: () => {
				app.isQuiting = true;
				
				// Clean up capture window if it exists
				if (captureWindow && !captureWindow.isDestroyed()) {
					captureWindow.close();
					captureWindow = null;
				}
				
				// Unregister global shortcuts
				globalShortcut.unregisterAll();
				
				// Destroy tray
				if (tray) {
					tray.destroy();
					tray = null;
				}
				
				// Force quit the app
				app.quit();
				
				// If app.quit() doesn't work, force exit
				setTimeout(() => {
					process.exit(0);
				}, 1000);
			}
		}
	]);
	
	tray.setContextMenu(contextMenu);
}



function setLanguage(language) {
	currentLanguage = language;
	updateTrayMenu(); // Update radio button states
	
	// Notify renderer of language change
	if (mainWindow && mainWindow.webContents) {
		mainWindow.webContents.send('language-changed', language);
	}
}

function registerGlobalShortcuts() {
	// Register Ctrl+Shift+T for quick screen capture
	const ret = globalShortcut.register('CommandOrControl+Shift+T', () => {
		console.log('Global hotkey triggered: Ctrl+Shift+T');
		startScreenCapture();
	});

	if (!ret) {
		console.log('Failed to register global shortcut: CommandOrControl+Shift+T');
	} else {
		console.log('Global shortcut registered: Ctrl+Shift+T for screen capture');
	}
}

// Prevent app from closing when all windows are closed (stay in tray)
app.on('window-all-closed', () => {
	// Don't quit on macOS
	if (process.platform !== 'darwin') {
		// Keep app running in tray
	}
});

app.on('activate', () => {
	if (mainWindow === null) {
		createMainWindow();
	}
});

app.on('before-quit', () => {
	// Clean up capture window if it exists
	if (captureWindow && !captureWindow.isDestroyed()) {
		captureWindow.close();
		captureWindow = null;
	}
	
	// Unregister all global shortcuts
	globalShortcut.unregisterAll();
	
	// Clean up tray icon before quitting
	if (tray) {
		tray.destroy();
		tray = null;
	}
});

app.on('will-quit', () => {
	// Final cleanup - unregister all global shortcuts
	globalShortcut.unregisterAll();
});