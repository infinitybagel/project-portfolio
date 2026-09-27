// Public student profile: "/profile/:uid"
import { getUserProfile, listProjectsByUser } from "../data.js";
import { avatarHtml, bindProjectOpen, emptyState, icons, projectCardHtml } from "../components.js";
import { state } from "../state.js";
import { esc, formatDate, safeUrl } from "../ui.js";

export async function render(root, ctx) {
  const [uid] = ctx.params;
  const [profile, projects] = await Promise.all([getUserProfile(uid), listProjectsByUser(uid)]);
  if (!ctx.isCurrent()) return;

  if (!profile) {
    root.innerHTML = emptyState({
      title: "Profile not found",
      body: "This student may have removed their portfolio.",
      action: `<a class="btn btn-primary" href="#/explore">Back to directory</a>`,
    });
    return;
  }

  document.title = `${profile.displayName} · Blueprint`;
  const isOwn = state.user?.id === uid;
  const github = safeUrl(profile.githubUrl);
  const linkedin = safeUrl(profile.linkedinUrl);
  const joined = formatDate(profile.createdAt);

  root.innerHTML = `
    <a class="back-link" href="#/explore">← All students</a>
    <section class="profile-header card">
      ${avatarHtml(profile, 112)}
      <div class="profile-info">
        ${profile.discipline ? `<span class="tag">${esc(profile.discipline)} Engineering</span>` : ""}
        <h1>${esc(profile.displayName)}</h1>
        ${profile.bio ? `<p class="profile-bio">${esc(profile.bio)}</p>` : ""}
        <div class="link-row">
          ${github ? `<a class="btn btn-secondary btn-sm" href="${esc(github)}" target="_blank" rel="noopener noreferrer">${icons.github(15)}GitHub</a>` : ""}
          ${linkedin ? `<a class="btn btn-secondary btn-sm" href="${esc(linkedin)}" target="_blank" rel="noopener noreferrer">${icons.linkedin(15)}LinkedIn</a>` : ""}
          ${profile.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${esc(profile.email)}">${icons.mail(15)}Email</a>` : ""}
          ${isOwn ? `<a class="btn btn-primary btn-sm" href="#/dashboard">${icons.edit(15)}Edit portfolio</a>` : ""}
        </div>
        ${joined ? `<p class="muted small">Member since ${esc(joined)}</p>` : ""}
      </div>
    </section>

    <div class="section-head">
      <h2>Projects <span class="count">${projects.length}</span></h2>
    </div>
    <div id="projects">
      ${
        projects.length
          ? `<div class="grid grid-projects">${projects.map((p) => projectCardHtml(p)).join("")}</div>`
          : emptyState({
              title: "No projects yet",
              body: isOwn ? "Add your first project from the dashboard." : "Check back soon.",
              action: isOwn ? `<a class="btn btn-primary" href="#/dashboard">Add a project</a>` : "",
            })
      }
    </div>`;

  const byId = new Map(projects.map((p) => [p.id, p]));
  bindProjectOpen(root.querySelector("#projects"), (id) => byId.get(id));
}
