# Auth

Local-only authentication for the first B-JOB FBS prototype.

- `auth.js` — login, session, employee CRUD.
- `permissions.js` — roles and explicit permissions.
- `Admin / Admin123` — built-in administrator.
- Passwords are intentionally local prototype data; this is not production security until a server-side identity provider is added.

Critical rule: warehouse viewing (`warehouse.view`) is separate from warehouse editing (`warehouse.edit`). A picker can see the warehouse map without receiving editing permission.
