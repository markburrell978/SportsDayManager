# Sports Day Manager

A reusable web application for managing an annual Sports Day.

---

## Features

- Team management
- Competitor management
- Multiple event types
- Live leaderboard
- Google Sheets database
- Mobile-friendly interface

---

## Technology Stack

| Component | Technology |
|----------|------------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Development | VS Code + clasp |
| Version Control | Git |

---

## Project Structure

```
sports-day-manager/
│
├── apps-script/
│   ├── Api.js
│   ├── Config.js
│   ├── Database.js
│   ├── TeamService.js
│   ├── CompetitorService.js
│   ├── EventService.js
│   ├── LeaderboardService.js
│   ├── Utils.js
│   └── appsscript.json
│
├── docs/
│   ├── DESIGN.md
│   ├── DATA_MODEL.md
│   └── TODO.md
│
├── web/
│
└── README.md
```

---

## Development Workflow

1. Edit code in VS Code.
2. Commit changes to Git.
3. Deploy using:

```bash
clasp push
```

---

## Current Version

v0.2.0