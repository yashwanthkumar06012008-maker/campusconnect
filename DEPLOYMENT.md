# Publish CampusConnect on Render

## Before you begin

You need a GitHub account and a Render account. The supplied configuration deploys the backend as a public web service.

This app uses a JSON file instead of a cloud database. A normal hosted filesystem is temporary, so this deployment attaches a persistent disk at `/var/data`. Render requires a paid web-service plan for persistent disks. The project works locally without any paid service.

## 1. Upload the project to GitHub

1. Go to [GitHub](https://github.com/new) and create a new repository named `campusconnect`.
2. Keep it private unless you deliberately want the source code publicly visible.
3. Upload **every file and folder** inside this `campus-event-management` folder. Do not upload only the `public` folder—the server and `render.yaml` are required.
4. Commit the uploaded files.

## 2. Create the host service

1. Sign in to [Render](https://dashboard.render.com/).
2. Select **New**, then **Blueprint**.
3. Connect GitHub if prompted and choose the `campusconnect` repository.
4. Render reads `render.yaml` automatically. Keep the suggested `campusconnect` service and click **Apply**.
5. When prompted for environment variables, set:
   - `ADMIN_EMAIL`: the email address that will access the dashboard.
   - `ADMIN_PASSWORD`: a strong, unique password. Do not use the demo password.
6. Start the deployment and wait until its status is **Live**.

The persistent disk is set to 1 GB at `/var/data`. The application writes registrations to `/var/data/campus-data.json`, so the data remains after normal deploys and restarts.

## 3. Open and test the public site

1. Select the new service in Render.
2. Open the `onrender.com` address shown at the top of the service page.
3. Register a test student for an event.
4. Open **Admin area**, sign in with the email and password you set, and confirm the registration is listed.
5. Use **Export CSV** to download the registration report.

## 4. Future updates

Edit your GitHub repository and push the changes. Render deploys the new revision automatically by default. Existing data under `/var/data` is retained.

## Important limitations

- The JSON file approach is suitable for a small project/demo. For a real campus deployment with many simultaneous registrations, migrate to a managed database and add production authentication and email verification.
- A service with a persistent disk cannot scale horizontally, so this configuration runs one application instance.
- Keep the administrator password private. Update it in Render’s environment-variable settings, not in source code.
