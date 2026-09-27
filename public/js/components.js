// Reusable HTML fragments: icons, avatars, project cards, project detail modal.
import { esc, formatDate, openModal, safeUrl, youTubeVideoId } from "./ui.js";

const svg = (paths, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  github: (s) =>
    svg('<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>', s),
  linkedin: (s) =>
    svg('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>', s),
  mail: (s) => svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>', s),
  link: (s) =>
    svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>', s),
  cube: (s) =>
    svg('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>', s),
  file: (s) =>
    svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', s),
  plus: (s) => svg('<path d="M12 5v14M5 12h14"/>', s),
  edit: (s) => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', s),
  trash: (s) =>
    svg('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s),
  x: (s) => svg('<path d="M18 6 6 18M6 6l12 12"/>', s),
  image: (s) =>
    svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>', s),
  arrow: (s) => svg('<path d="M5 12h14M12 5l7 7-7 7"/>', s),
  youtube: (s) =>
    svg('<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>', s),
  play: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l10.9-6.9a1 1 0 0 0 0-1.7L9.5 4.2A1 1 0 0 0 8 5.1z"/></svg>`,
};

// ---------- Avatars ----------

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hue(seed) {
  let h = 0;
  for (const ch of String(seed || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function avatarHtml(profile, size = 48) {
  const name = profile?.displayName || "Student";
  const url = safeUrl(profile?.profilePictureUrl);
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
  if (url) {
    return `<img class="avatar" src="${esc(url)}" alt="${esc(name)}" style="${style}" loading="lazy">`;
  }
  return `<span class="avatar avatar-fallback" style="${style};--h:${hue(profile?.id || name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

// ---------- Links ----------

const PROJECT_LINKS = [
  ["projectLink", "Project page", icons.link],
  ["githubLink", "GitHub", icons.github],
  ["cadLink", "CAD files", icons.cube],
  ["reportLink", "Report", icons.file],
  ["youtubeLink", "YouTube", icons.youtube],
];

export function projectLinksHtml(project, { compact = false } = {}) {
  const links = PROJECT_LINKS.map(([key, label, icon]) => {
    const url = safeUrl(project[key]);
    if (!url) return "";
    return compact
      ? `<a class="icon-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${label}" aria-label="${label}">${icon(16)}</a>`
      : `<a class="btn btn-secondary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon(15)}${label}</a>`;
  }).join("");
  return links ? `<div class="${compact ? "icon-links" : "link-row"}">${links}</div>` : "";
}

// ---------- Tags ----------

/**
 * Renders a project's topic tags.
 * @param max        show at most this many, then a "+N" counter
 * @param clickable  render tags as filter buttons (data-tag) instead of plain labels
 */
export function tagsHtml(tags = [], { max = Infinity, clickable = false } = {}) {
  if (!tags.length) return "";
  const shown = tags.slice(0, max);
  const items = shown.map((t) =>
    clickable
      ? `<li><button type="button" class="tag tag-btn" data-tag="${esc(t)}" title="Show projects tagged ${esc(t)}">${esc(t)}</button></li>`
      : `<li><span class="tag">${esc(t)}</span></li>`
  );
  if (tags.length > shown.length) {
    const rest = tags.slice(shown.length).join(", ");
    items.push(`<li><span class="tag tag-more" title="${esc(rest)}">+${tags.length - shown.length}</span></li>`);
  }
  return `<ul class="tag-list" aria-label="Tags">${items.join("")}</ul>`;
}

// ---------- Project cards ----------

function mediaHtml(project) {
  const url = safeUrl(project.imageUrl);
  if (url) return `<img src="${esc(url)}" alt="" loading="lazy">`;
  const videoId = youTubeVideoId(project.youtubeLink);
  if (videoId) {
    return `<img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="" loading="lazy">
            <span class="play-badge">${icons.play(18)}</span>`;
  }
  return `<div class="media-placeholder"><span>${esc(project.tags?.[0] || "Project")}</span></div>`;
}

/**
 * @param owner     optional profile shown as a byline (used in the Explore feed)
 * @param actions   when true, show Edit/Delete buttons instead of links (dashboard)
 * @param tagFilter when true, tags are buttons that filter the Explore feed
 */
export function projectCardHtml(project, { owner = null, actions = false, tagFilter = false } = {}) {
  const id = esc(project.id);
  return `
    <article class="project-card">
      <button class="project-media" type="button" data-open="${id}" aria-label="Open ${esc(project.title)}">
        ${mediaHtml(project)}
      </button>
      <div class="project-body">
        ${tagsHtml(project.tags, { max: 3, clickable: tagFilter })}
        <h3><button type="button" class="title-btn" data-open="${id}">${esc(project.title)}</button></h3>
        ${project.description ? `<p class="clamp-3 muted">${esc(project.description)}</p>` : ""}
        <div class="project-foot">
          ${
            owner
              ? `<a class="byline" href="#/profile/${esc(owner.id)}">${avatarHtml(owner, 24)}<span>${esc(owner.displayName)}</span></a>`
              : `<span></span>`
          }
          ${
            actions
              ? `<div class="card-actions">
                   <button type="button" class="btn btn-ghost btn-sm" data-edit="${id}">${icons.edit(14)}Edit</button>
                   <button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-delete="${id}">${icons.trash(14)}Delete</button>
                 </div>`
              : projectLinksHtml(project, { compact: true })
          }
        </div>
      </div>
    </article>`;
}

export function openProjectDetail(project, owner = null) {
  const imageUrl = safeUrl(project.imageUrl);
  const videoId = youTubeVideoId(project.youtubeLink);
  const date = formatDate(project.createdAt);
  // A YouTube demo takes the header slot; otherwise show the project image.
  const header = videoId
    ? `<div class="detail-video">
         <iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="${esc(project.title)} — video"
           allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>
       </div>`
    : imageUrl
      ? `<img class="detail-image" src="${esc(imageUrl)}" alt="${esc(project.title)}">`
      : "";
  openModal(
    `<button class="modal-close" type="button" data-close aria-label="Close">${icons.x(18)}</button>
     ${header}
     <div class="detail-body">
       ${tagsHtml(project.tags)}
       <h2>${esc(project.title)}</h2>
       <div class="detail-meta">
         ${owner ? `<a class="byline" href="#/profile/${esc(owner.id)}" data-close>${avatarHtml(owner, 24)}<span>${esc(owner.displayName)}</span></a>` : ""}
         ${date ? `<span class="muted">${esc(date)}</span>` : ""}
       </div>
       ${project.description ? `<p class="detail-desc">${esc(project.description)}</p>` : ""}
       ${videoId && imageUrl ? `<img class="detail-image detail-image-inline" src="${esc(imageUrl)}" alt="${esc(project.title)}">` : ""}
       ${projectLinksHtml(project)}
     </div>`,
    { size: "lg", label: project.title }
  );
}

/** Wires "open detail" clicks for a grid of project cards. */
export function bindProjectOpen(container, getProject, getOwner = () => null) {
  container.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open]");
    if (!trigger) return;
    const project = getProject(trigger.dataset.open);
    if (project) openProjectDetail(project, getOwner(project));
  });
}

export function emptyState({ title, body = "", action = "" }) {
  return `<div class="empty">
    <div class="empty-icon">${icons.cube(28)}</div>
    <h3>${esc(title)}</h3>
    ${body ? `<p class="muted">${esc(body)}</p>` : ""}
    ${action}
  </div>`;
}

export const loadingHtml = `<div class="loading" role="status"><span class="spinner"></span>Loading…</div>`;
