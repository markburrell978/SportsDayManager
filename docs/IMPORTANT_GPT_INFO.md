Here's the roadmap I want to follow

Current implementation is v0.8.0. Completed Event Runs require explicit result confirmation. The organiser live leaderboard dynamically scores current-run Results.Position values with current point profiles and uses competition ranking. Historical runs do not count toward that leaderboard.

Event History is read-only and viewed per event. It reconstructs all current and previous runs from existing EventRuns, engine rows and Results without a snapshot table. Historical point displays use the event's current profile, including dynamic round-robin tie averaging. Historical runs cannot be edited, restored, confirmed, reset or deleted. v0.9.0 — Offline Mode is next but is not implemented. The shareable leaderboard remains a v1.2 stretch item.

Point Profile Simplification v0.5.9, Points Calculation v0.6.0 and Live Leaderboard v0.7.0 are incorporated beneath v0.8.0. PointProfiles uses exactly ID, Name, First, Second, Third and Fourth; runtime code must not expect Position/Points row arrays.

Now that the tooling is sorted, the next milestones are very clear:

v0.2.0 - Backend Foundation
Config.gs
Utils.gs
Database.gs
Api.gs
v0.3.0 - First Frontend
HTML shell
API communication
Load teams from the sheet
v0.4.0 - Competitor Management
Add
Edit
Present/Absent
Delete

After that, we'll build each event type one by one.
