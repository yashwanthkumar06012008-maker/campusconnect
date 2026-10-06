# CampusConnect — Event Management System

A complete, dependency-free Campus Event Management System. The responsive front end and the Node.js backend are both included; all submitted data is saved locally in `data/campus-data.json` when the server first runs.

## Run it locally

1. Open PowerShell in this folder.
2. Run `node server.js`.
3. Visit `http://localhost:3000` in a browser.

## Working features

- Browse, search, and filter campus events.
- Register for an event; registrations persist and capacity updates immediately.
- Send contact messages and join the newsletter; both persist.
- Administrator dashboard: sign in, see real totals and registrations, create/delete events, and export registrations as CSV.

The demo administrator credentials are:

`admin@campus.edu` / `campus2026`

For a non-demo deployment, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `PORT` environment variables before starting the server.

## Deploy it publicly on Vercel

This repository includes a Vercel serverless API and uses Neon Postgres for durable cloud storage. Before deploy, use real administrator credentials instead of the demo password:

1. Upload this entire folder to a new GitHub repository.
2. In Vercel, import that GitHub repository as a project.
3. Add the **Neon** integration from Vercel’s Storage tab and connect it to the project. This supplies `DATABASE_URL`.
4. In the project’s Environment Variables, add `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `ADMIN_SECRET`.
5. Deploy and open the generated `vercel.app` address.

The Vercel version saves data in Neon Postgres. The local version still uses `data/campus-data.json`. Follow the detailed [Vercel deployment guide](VERCEL_DEPLOYMENT.md).
