# Publish CampusConnect on Vercel

## What this deployment uses

Vercel hosts the website and serverless API. The application does **not** write registrations to a JSON file on Vercel; serverless functions are not a durable file database. Instead, the included `api/[...path].js` API saves all live data in Neon Postgres.

The project still runs locally with the JSON file when you start `server.js`.

## 1. Put the project on GitHub

1. Go to [GitHub](https://github.com/new) and create a repository called `campusconnect`.
2. Choose **Private** unless you intentionally want the source code to be public.
3. Upload every file and folder inside this `campus-event-management` folder, including `api`, `public`, `package.json`, and `vercel.json`.
4. Commit the files.

## 2. Create the Vercel project

1. Open [Vercel](https://vercel.com/new) and sign in with GitHub.
2. Select the `campusconnect` repository and click **Import**.
3. Keep the detected framework setting as **Other**.
4. Do not deploy yet; create the database first.

## 3. Add the Neon database

1. In the Vercel project, open **Storage**.
2. Click **Browse Marketplace**, select **Neon**, then install it.
3. Create a Neon Postgres database, preferably in a region close to your users.
4. Connect the database to this Vercel project and include the **Production** environment.

Vercel adds `DATABASE_URL` automatically when the Neon integration is connected. On the first live request, CampusConnect creates its tables and starter events automatically.

## 4. Add administrator secrets

In **Settings → Environment Variables**, add these three Production variables:

| Name | What to enter |
| --- | --- |
| `ADMIN_EMAIL` | Your administrator email address |
| `ADMIN_PASSWORD` | A strong, unique password |
| `ADMIN_SECRET` | A long random secret (at least 32 characters) used to secure admin sessions |

Do not use `admin@campus.edu` / `campus2026` in a public deployment.

## 5. Deploy

1. Return to the **Deployments** tab and click **Redeploy**, or push a small change to GitHub.
2. Wait for the deployment to show **Ready**.
3. Click the supplied `vercel.app` URL.
4. Submit one test registration.
5. Open **Admin area**, log in with your environment-variable credentials, and confirm the registration appears.

## Future updates

Push changes to GitHub. Vercel creates a new deployment automatically. Your events, registrations, messages, and subscribers stay in Neon Postgres across deployments.

## Security and project limits

- Keep all three administrator environment variables private. Never put them into `app.js`, `server.js`, or GitHub.
- For a real college-wide system, add student authentication, email verification, rate limiting, and a privacy policy before collecting personal data.
- The Neon integration can be created through Vercel’s Marketplace. Check the selected plan’s current limits before public launch.
