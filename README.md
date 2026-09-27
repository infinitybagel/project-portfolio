# Blueprint: Engineering Student Portfolios

Blueprint is a portfolio website for engineering students in every discipline, including mechanical, electrical, civil, software, biomedical and aerospace. Students create an account, build a profile, and publish their projects. Anyone can browse the directory to see what other students are building.

## What the website does

### For visitors
- **Explore the directory:** browse every student's profile card, or switch to the **Projects** feed to see recent work from everyone.
- **Search and filter:** search names, bios, project titles, descriptions and tags. Filter by engineering discipline. Click any project tag (for example **Robotics**) to show only projects with that tag. Filtered views have shareable links, such as `#/explore?tab=projects&tag=Robotics`.
- **View profiles:** each student's page shows their photo, discipline, bio, contact links (GitHub, LinkedIn, YouTube, email) and a grid of their projects.
- **View projects:** opening a project shows its full description, tags and links. If the project has a YouTube video, it plays right on the page.

### For students (after signing up)
- **Account:** sign up with email and password (with email confirmation), log in and out, and reset a forgotten password by email.
- **Profile:** set your name, discipline and bio, upload a profile photo, and add GitHub, LinkedIn and YouTube channel links.
- **Projects:** add, edit and delete projects. Each project has:
  - a title and a description or methodology
  - **up to 8 topic tags**, for example *Embedded Systems*, *Robotics* and *IoT*. You can pick from suggestions or type your own.
  - an image (hardware photo, CAD render or screenshot). Images are resized in the browser before upload.
  - optional links: project page or demo, GitHub repository, CAD files, report, and a **YouTube video**. If there's no image, the video's thumbnail is used on the card.

### Security
- Anyone can view profiles and projects, but only the owner can change their own profile, projects and images. The database enforces this with Row Level Security, not just the website.
- The database also checks field lengths, tag limits and that links start with `http(s)`. It prevents users from changing timestamps, a profile's email, or who owns a project.
- Image uploads must be images under 5 MB.

## Technologies used

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS and JavaScript ES modules, with no framework and no build step. A small hash-based router handles navigation. |
| Styling | Hand-written CSS with light and dark themes and a responsive, mobile-friendly layout. Fonts are [Inter](https://fonts.google.com/specimen/Inter) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono). |
| Authentication | [Supabase Auth](https://supabase.com/docs/guides/auth): email and password, email confirmation, password reset (PKCE flow) |
| Database | [Supabase Postgres](https://supabase.com/docs/guides/database) with Row Level Security policies, check constraints and triggers |
| File storage | [Supabase Storage](https://supabase.com/docs/guides/storage): public buckets for profile photos and project images |
| Client library | [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) v2, loaded from the jsDelivr CDN |
| Video | YouTube embeds via `youtube-nocookie.com` |
| Hosting | Any static host. The repo includes a [Netlify](https://www.netlify.com/) config (`netlify.toml`). |

### Project structure

```
netlify.toml               Netlify settings (publish folder, cache headers)
supabase/schema.sql        Tables, triggers, security policies, storage buckets
public/                    ← the website (this folder is what gets deployed)
  index.html               App shell
  css/styles.css           Styles
  js/
    supabase-config.js     Your Supabase project URL + public key
    supabase.js            Supabase client setup
    app.js                 Router, navigation, login state
    data.js                Reading/writing profiles, projects and images
    components.js          Project cards, tags, avatars, project detail view
    tag-input.js           Tag editor used in the project form
    ui.js                  Shared helpers (links, tags, YouTube, toasts, dialogs, images)
    views/                 Pages: explore, profile, login, register, reset-password, dashboard
```

### Data model

- **`profiles`** (one row per user): `display_name`, `email`, `discipline`, `bio`, `profile_picture_url`, `github_url`, `linkedin_url`, `youtube_url`, timestamps
- **`projects`**: `user_id`, `title`, `tags` (text array), `description`, `image_url`, `project_link`, `github_link`, `cad_link`, `report_link`, `youtube_link`, timestamps
- **Storage buckets:** `profile_pictures/{userId}` and `project_images/{projectId}`

## Setup instructions

### 1. Create the Supabase backend
1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, security policies and storage buckets.

> **Already set up an earlier version?** Run `supabase/schema.sql` again. It's safe to re-run, keeps all existing data, and adds the new columns (YouTube links and tags). Each project's old single category becomes its first tag. **Run it before using the updated site**, because the new code expects those columns.

### 2. Connect the website to Supabase
1. In Supabase, go to **Project Settings → API** (or click **Connect**). Copy the **Project URL** (`https://xxxx.supabase.co`) and the **anon / publishable** key.
2. Paste them into [`public/js/supabase-config.js`](public/js/supabase-config.js):
   ```js
   export const supabaseConfig = {
     url: "https://xxxx.supabase.co",
     anonKey: "sb_publishable_... or eyJ...",
   };
   ```
   This key is meant to be public, because the database security policies protect the data. **Never** put the `service_role` / secret key in this project.

### 3. Configure authentication URLs
In Supabase, go to **Authentication → URL Configuration**:
- **Site URL:** where the site runs. Use `http://localhost:5173` for local testing, and change it to your Netlify URL once deployed.
- **Redirect URLs:** add every address the site is served from, for example `http://localhost:5173/**` and `https://your-site.netlify.app/**`. Confirmation and password-reset emails send people back to these.

### 4. Run locally
The site must be served over HTTP. Opening `index.html` directly from disk won't work. With Python installed:

```bash
python -m http.server 5173 --directory public
```

Then open <http://localhost:5173>. Any static file server works (for example `npx serve public`).

### 5. Deploy to Netlify
1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repository. `netlify.toml` already sets the publish directory to `public` with no build command, so leave the build settings empty.
3. After the first deploy, copy the site URL (for example `https://your-site.netlify.app`). In Supabase **Authentication → URL Configuration**, set it as the **Site URL** and add `https://your-site.netlify.app/**` to **Redirect URLs**.
4. Every push to `main` redeploys automatically.

### 6. Before inviting testers
- **Email limits:** Supabase's built-in email sender is limited to a few emails per hour. That isn't enough for several people signing up. Either:
  - configure your own SMTP provider (such as Resend, SendGrid or Mailgun) under **Authentication → Emails → SMTP Settings**, or
  - for a short test, turn off **Confirm email** under **Authentication → Providers → Email**, so accounts work immediately without an email.
- **Public profiles:** each student's email appears on their public profile as a contact link. Let testers know, or see the note below to hide it.

## Notes

- URLs use a `#` (for example `/#/profile/abc123`), so the site works on any static host without rewrite rules.
- To make emails private, remove `email` from `PROFILE_COLUMNS` in `public/js/data.js`.
- The directory loads all profiles and the latest 100 projects, then filters them in the browser. That's fine for a class or club. For thousands of users, switch to paginated queries.
