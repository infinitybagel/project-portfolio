# Blueprint: Engineering Student Portfolios

A portfolio web app for engineering students in any discipline. Students register, build a profile, and publish projects. Anyone can browse the public directory.

Built with plain HTML, CSS and JavaScript ES modules. The backend is **Supabase**: Auth for accounts, Postgres with Row Level Security for data, and Storage for images. The Supabase library loads from a CDN, so there's no build step and no npm install.

## Features

| Area | What's included |
|---|---|
| **Auth** | Email/password sign-up (works with or without email confirmation), log in, log out, and password reset by email with a page to set a new password. Sessions persist across visits. The dashboard route is protected |
| **Directory** (`#/` or `#/explore`) | Grid of all students, a Projects feed, text search, and filter chips for each discipline |
| **Profile** (`#/profile/:uid`) | Photo, discipline, bio, GitHub/LinkedIn/email links, project grid, and a detail view for each project |
| **Dashboard** (`#/dashboard`) | Edit profile and upload a photo. Create, edit and delete projects in a modal, with image upload, category, description and four link types |
| **Security** | RLS policies: anyone can read, only the owner can write. Database check constraints limit field lengths and require http(s) links. Triggers stop clients from changing timestamps, ownership or email. Storage buckets only accept images under 5 MB |

Images are resized in the browser before upload: profile photos to 512 px and project images to 1600 px.

## Project structure

```
supabase/schema.sql        Tables, triggers, RLS policies, storage buckets and policies
public/
  index.html               App shell
  css/styles.css           Styles (light + dark)
  js/
    supabase-config.js     ← paste your project URL + anon key here
    supabase.js            Client initialization
    app.js                 Router, nav, auth listener
    data.js                Database/Storage CRUD (maps rows to camelCase)
    components.js          Cards, avatars, project detail modal
    ui.js                  Helpers (escaping, toasts, modals, image resize, errors)
    views/                 explore, profile, login, register, reset-password, dashboard
```

## Data model

**`public.profiles`** (one row per user, `id` = `auth.users.id`): `display_name`, `email`, `discipline`, `bio`, `profile_picture_url`, `github_url`, `linkedin_url`, `created_at`, `updated_at`

**`public.projects`**: `id`, `user_id` → profiles, `title`, `discipline` (category, e.g. "CAD Design"), `description`, `image_url`, `project_link`, `github_link`, `cad_link`, `report_link`, `created_at`, `updated_at`

**Storage buckets** (public read): `profile_pictures/{uid}` and `project_images/{projectId}`

A database trigger creates each user's profile row at sign-up, using the name and discipline from the registration form.

## Setup

1. **Create a project** at <https://supabase.com/dashboard>.
2. **Run the schema**: open **SQL Editor**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It's safe to re-run.
3. **Auth settings**: go to **Authentication → URL Configuration**:
   - Set **Site URL** to where the app is hosted (for local development, `http://localhost:5173/`).
   - Add every URL you'll serve the app from to **Redirect URLs** (for example `http://localhost:5173/**` and your production URL). Confirmation and password-reset emails send users back here.
   - Email confirmation is **on** by default. New users see a "Check your email" screen and are signed in when they click the link. To skip that step while developing, turn off **Confirm email** under **Authentication → Providers → Email**.
4. **Keys**: copy the **Project URL** and the **anon public** key from **Project Settings → API** into [`public/js/supabase-config.js`](public/js/supabase-config.js). The anon key is meant to be public, because RLS is what protects the data. Never put the `service_role` key in this app.

## Run locally

ES modules must be served over HTTP. Opening `index.html` directly from disk won't work.

```bash
python -m http.server 5173 --directory public
```

Then open <http://localhost:5173>.

## Deploy

The `public/` folder is a plain static site. Upload it to any static host, such as Netlify, Vercel, Cloudflare Pages, GitHub Pages or Firebase Hosting. Then add the production URL to Supabase's **Redirect URLs** (and make it the **Site URL**).

## Notes

- Routes use hash URLs (`#/profile/abc123`), so no server rewrite rules are needed. Auth email links use the PKCE flow (`?code=…`), so they don't collide with the hash router.
- Supabase's built-in email sender is rate-limited to a few emails per hour. For real use, configure custom SMTP under **Authentication → Emails → SMTP Settings**.
- Profile emails are public, because they appear as the "Email" contact link. To make them private, remove `email` from `PROFILE_COLUMNS` in `data.js`, or revoke column access in SQL.
- The directory loads all profiles and the latest 100 projects, then filters them in the browser. That's fine for a class or club. For thousands of users, switch to paginated queries (`.range()`).
