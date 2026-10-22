# School17 Teacher (Windows)

A small desktop app for teachers (like Telegram Desktop): sign in, pick a class, drop video files, done.

- Run: double-click the "School17 Teacher" shortcut on the Desktop, or `School17-TeacherSchool17 Teacher.exe` (folder next to `desktop/`, no install). Rebuild with `npm run dist` (folder build: `npx electron-builder --win dir`).
- Sign in with the phone number (code arrives in Telegram) or e-mail + password. Teachers only.
- Class: drop videos on the big box. They upload in pieces (resumes after a drop), appear in the class library, and the class chat gets a "New video" message.
- Topic videos: add YouTube / Vimeo links to a topic.
- Server: https://mamun2appforuse.onrender.com (override with env `SCHOOL17_API_URL`).
- Dev: `npm install`, `npm start`. Build: `npm run dist` (if the download of Electron is blocked, add `-c.electronDist=<abs path to node_modules/electron/dist>`).
