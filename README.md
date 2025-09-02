Tomato Pomodoro
===============

Professional tomato-themed Pomodoro timer web application. Pure HTML/CSS/JS with PWA support, tasks, statistics, accessibility, and offline functionality.

Features
--------
- 25/5/15 defaults, customizable durations and long break cadence
- Start, pause, reset, skip; auto progression; session counter
- Tomato SVG UI with dynamic color themes (work/short/long), progress ring, smooth transitions
- Task management: add/edit/delete, drag-and-drop order, estimated pomodoros, spent count, clear completed
- Audio cues with volume + mute; desktop notifications (optional)
- Statistics: daily/weekly/monthly totals, overall focus time, streak
- Data persistence via localStorage; import/export JSON backup
- PWA with offline cache; tab title shows current status
- Accessibility: ARIA labels, keyboard shortcuts (Space to start/pause, Esc to close dialogs), focus styles

Getting Started
---------------
1. Serve the folder locally (required for service worker and audio):
   - Python: `python -m http.server 5173`
   - Node: `npx serve -s . -l 5173`
2. Open `http://localhost:5173` in your browser.
3. Use Space to start/pause, customize durations in Settings, and add tasks.

Files
-----
- `index.html` – App layout, tomato SVG, dialogs, audio elements
- `styles.css` – Themes, responsive layout, modern gradients
- `app.js` – Timer logic, tasks, settings, stats, notifications
- `service-worker.js` – Offline caching
- `manifest.webmanifest` – PWA manifest

Notes
-----
- Data is stored locally; exporting creates a JSON backup you can later import.
- Notifications require granting permission in Settings.
- Works offline after first load.

License
-------
MIT


