# AI Context

Project: Sports Day Manager

Version: v0.6.0

---

## Purpose

This application is used to run an annual Sports Day event.

The organiser uses the application throughout the day to:

- manage competitors
- manage events
- record results
- calculate team scores
- display a live leaderboard

The application is intentionally designed to be reusable for future years.

---

# Architecture

The project is split into two completely separate applications.

```
apps-script/
```

Google Apps Script backend.

Responsibilities:

- REST API
- Google Sheets access
- Business logic
- UUID generation
- Data validation

Google Sheets should ONLY be accessed through Database.js.

---

```
web/
```

Static frontend.

Responsibilities:

- UI
- API calls
- Rendering
- User interaction

The frontend never communicates directly with Google Sheets.

---

# Design Principles

Keep the architecture simple.

Avoid unnecessary frameworks.

Prefer plain JavaScript.

Business logic belongs in Services.

Database.js is the only place allowed to access Google Sheets.

API endpoints should be thin.

Event execution data belongs to an Event Run. Events are permanent configuration; EventRuns are resettable executions. Every engine record is scoped by EventRunID, and reset creates a new current run without deleting historical rows.

Completed Event Runs require explicit organiser confirmation before Results rows are generated. Results.Position is authoritative; PointsAwarded is a compatibility snapshot. Reconfirmation replaces only the current run's Results rows.

---

# Development Workflow

The AI acts as Technical Lead.

Each release should:

- have a version number
- have a clear objective
- modify as few files as possible
- provide complete replacement files (not snippets)

Never provide partial patches if a whole file has changed.

---

# Current Development Style

The user prefers:

- complete files
- minimal boilerplate
- clean architecture
- readable code over clever code

Avoid introducing unnecessary abstractions.

Do not redesign working code without a good reason.

---

# Backend

Apps Script.

Google Sheets datastore.

Uses clasp.

Uses VS Code.

---

# Frontend

Plain HTML.

Plain CSS.

Plain JavaScript.

No frameworks.

---

# Data

Competitors

- ID
- Name
- Age
- Gender
- CompetitionGender
- TeamID
- Active

Teams

- ID
- Name
- Colour
- Points

Events

Support multiple event formats.

Event formats are separate from point allocation.

This allows different events of the same type to award different points.

---

# Coding Standards

Prefer early returns.

Prefer descriptive function names.

Prefer constants.

Avoid duplicated logic.

One responsibility per function.

Keep files organised.

---

# Documentation

Update when necessary:

- CHANGELOG.md
- TODO.md
- DESIGN.md
- DATA_MODEL.md
- API.md

---

# Long-term Roadmap

Competitors

↓

Events

↓

Scoring

↓

Leaderboard

↓

Settings

↓

Historical Sports Days

---

# Important Decisions

This application is designed for one organiser.

Accessibility improvements are postponed until after this year's Sports Day.

Optimise for reliability over polish.

Working software is preferred over perfect architecture.

Optimise for less than 5 hours more work
