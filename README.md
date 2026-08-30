# Winter Arc

A premium, fully client-side habit tracker with a dark winter aesthetic.  
**No accounts. No backend. No paid APIs.** All data lives in `localStorage`.

## Features

- **Habits** — create, edit, delete, drag-to-reorder; daily check/uncheck
- **Dashboard** — today’s score, streak, XP/rank, quick checklist
- **Calendar** — monthly view with completion heat; open any past day to edit
- **Statistics** — current/best streaks, 7-day & 30-day rates, per-habit consistency
- **Goals** — personal goals with optional deadlines and progress sliders
- **Settings** — sound, reduced motion, export/import JSON backup, full reset
- **PWA-ready** — offline cache via service worker; installable on mobile
- **Responsive** — sidebar on desktop, bottom nav on phone

## Project structure

```
winter-arc/
├── index.html
├── css/style.css
├── js/app.js
├── manifest.json
├── service-worker.js
└── README.md
```

## Local preview

Open `index.html` in a browser, or run a simple static server:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `winter-arc`).
2. Upload every file in this folder to the **root** of the repo (or push via git):

   ```bash
   git init
   git add .
   git commit -m "Winter Arc habit tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/winter-arc.git
   git push -u origin main
   ```

3. In the repo on GitHub: **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/ (root)**. Click **Save**.
6. After a minute, your app is live at:

   `https://YOUR_USERNAME.github.io/winter-arc/`

### If the site is in a subfolder

Paths in this project are relative (`./css/…`, `./js/…`), so they work both at the domain root and under a project path like `/winter-arc/`.

## Data & privacy

- Everything is stored under the key `winterarc:v4` in the browser’s `localStorage`.
- Export a JSON backup from **Settings** before clearing site data or switching devices.
- Import restores the full state (habits, history, goals, settings).

## License

Free to use and modify for personal or commercial projects.
