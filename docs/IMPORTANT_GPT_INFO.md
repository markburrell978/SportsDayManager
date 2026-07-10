Here's the roadmap I want to follow

Current implementation is v0.6.0. Completed Event Runs require explicit result confirmation. Live leaderboard work is planned for v0.7.0, while the shareable leaderboard is a v1.2 stretch item.

Point Profile Simplification v0.5.9 is incorporated beneath v0.6.0. PointProfiles uses exactly ID, Name, First, Second, Third and Fourth; runtime code must not expect Position/Points row arrays.

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
