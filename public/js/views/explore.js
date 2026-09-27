// Public directory: "/" and "/explore"
import { listRecentProjects, listUsers } from "../data.js";
import { avatarHtml, bindProjectOpen, emptyState, icons, projectCardHtml } from "../components.js";
import { state } from "../state.js";
import { esc } from "../ui.js";

export async function render(root, ctx) {
  const [users, projects] = await Promise.all([listUsers(), listRecentProjects(100)]);
  if (!ctx.isCurrent()) return;

  const owners = new Map(users.map((u) => [u.id, u]));
  const projectsByUser = new Map();
  for (const p of projects) {
    if (!projectsByUser.has(p.userId)) projectsByUser.set(p.userId, []);
    projectsByUser.get(p.userId).push(p);
  }
  const byId = new Map(projects.map((p) => [p.id, p]));
  const disciplines = [...new Set(users.map((u) => u.discipline).filter(Boolean))].sort();
  // Distinct project tags, case-insensitive ("IoT" and "iot" count once).
  const topicCount = new Set(projects.flatMap((p) => p.tags.map((t) => t.toLowerCase()))).size;

  let activeTag = ctx.query.get("tag") || "";
  let tab = ctx.query.get("tab") === "projects" || activeTag ? "projects" : "students";
  let terms = []; // lowercase search words; every word must appear (any order)
  let discipline = "";

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Engineering student portfolios</p>
      <h1>See what the next generation of engineers is building.</h1>
      <p class="lede">Browse students and projects across mechanical, electrical, civil, software, biomedical, aerospace and more.</p>
      <div class="hero-actions">
        ${
          state.user
            ? `<a class="btn btn-primary" href="#/dashboard">Go to your dashboard ${icons.arrow(16)}</a>`
            : `<a class="btn btn-primary" href="#/register">Create your portfolio ${icons.arrow(16)}</a>
               <a class="btn btn-secondary" href="#/login">Log in</a>`
        }
      </div>
      <dl class="hero-stats">
        <div><dt>Students</dt><dd>${users.length}</dd></div>
        <div><dt>Projects</dt><dd>${projects.length}${projects.length >= 100 ? "+" : ""}</dd></div>
        <div><dt>Project topics</dt><dd>${topicCount}</dd></div>
      </dl>
    </section>

    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Browse">
        <button role="tab" type="button" data-tab="students">Students</button>
        <button role="tab" type="button" data-tab="projects">Projects</button>
      </div>
      <label class="search">
        ${icons.search(16)}
        <input type="search" id="search" placeholder="Search names, schools, projects, skills…" aria-label="Search">
      </label>
    </div>
    ${
      disciplines.length
        ? `<div class="chips" role="group" aria-label="Filter by discipline">
            <button type="button" class="chip" data-discipline="">All</button>
            ${disciplines.map((d) => `<button type="button" class="chip" data-discipline="${esc(d)}">${esc(d)}</button>`).join("")}
          </div>`
        : ""
    }
    <div id="tag-filter"></div>
    <div id="results" aria-live="polite"></div>`;

  const results = root.querySelector("#results");
  const tagFilter = root.querySelector("#tag-filter");

  const syncUrl = () => {
    const params = new URLSearchParams();
    if (tab === "projects") params.set("tab", "projects");
    if (tab === "projects" && activeTag) params.set("tag", activeTag);
    const qs = params.toString();
    history.replaceState(null, "", `#/explore${qs ? `?${qs}` : ""}`);
  };
  const hasTag = (p) => !activeTag || p.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase());

  const matchesAll = (text) => {
    const t = text.toLowerCase();
    return terms.every((term) => t.includes(term));
  };
  const matchesAny = (text) => {
    const t = text.toLowerCase();
    return terms.some((term) => t.includes(term));
  };
  const profileText = (u) => `${u.displayName} ${u.discipline} ${u.school} ${u.bio}`;
  const projectText = (p) => `${p.title} ${p.tags.join(" ")} ${p.description}`;
  const projectMatches = (p) => {
    const owner = owners.get(p.userId);
    return (
      (!discipline || owner?.discipline === discipline) &&
      hasTag(p) &&
      matchesAll(`${projectText(p)} ${owner?.displayName ?? ""}`)
    );
  };

  function draw() {
    root.querySelectorAll("[data-tab]").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    root.querySelectorAll("[data-discipline]").forEach((b) =>
      b.classList.toggle("active", b.dataset.discipline === discipline)
    );

    tagFilter.innerHTML =
      tab === "projects" && activeTag
        ? `<div class="active-filter">Tagged <span class="tag">${esc(activeTag)}</span>
             <button type="button" class="text-btn" data-clear-tag>Clear</button></div>`
        : "";

    if (tab === "students") {
      // A student matches on their own details *or* their projects (titles, tags, descriptions),
      // so searching a topic like "immunology" finds the student who worked on it.
      const list = users.filter((u) => {
        if (discipline && u.discipline !== discipline) return false;
        const theirProjects = projectsByUser.get(u.id) ?? [];
        return matchesAll(`${profileText(u)} ${theirProjects.map(projectText).join(" ")}`);
      });
      const matchingProjectCount = terms.length ? projects.filter(projectMatches).length : 0;
      const hint = matchingProjectCount
        ? `<div class="search-hint">
             ${matchingProjectCount} matching project${matchingProjectCount === 1 ? "" : "s"}
             <button type="button" class="text-btn" data-show-projects>View projects ${icons.arrow(13)}</button>
           </div>`
        : "";
      results.innerHTML = list.length
        ? `${hint}<div class="grid grid-students">${list
            .map((u) => studentCardHtml(u, terms.length ? projectHighlights(u) : []))
            .join("")}</div>`
        : hint
          ? `${hint}${emptyState({ title: "No students match", body: "But some projects do — view them above." })}`
          : users.length
          ? emptyState({ title: "No students match", body: "Try a different search or discipline." })
          : emptyState({
              title: "No portfolios yet",
              body: "Be the first engineering student to publish a portfolio.",
              action: state.user ? "" : `<a class="btn btn-primary" href="#/register">Create your portfolio</a>`,
            });
    } else {
      const list = projects.filter(projectMatches);
      results.innerHTML = list.length
        ? `<div class="grid grid-projects">${list
            .map((p) => projectCardHtml(p, { owner: owners.get(p.userId), tagFilter: true }))
            .join("")}</div>`
        : emptyState({
            title: projects.length ? "No projects match" : "No projects yet",
            body: projects.length ? "Try a different search, discipline or tag." : "Projects will appear here as students add them.",
          });
    }
  }

  root.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    syncUrl();
    draw();
  });
  root.querySelector(".chips")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-discipline]");
    if (!b) return;
    discipline = b.dataset.discipline;
    draw();
  });
  root.querySelector("#search").addEventListener("input", (e) => {
    terms = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    draw();
  });
  results.addEventListener("click", (e) => {
    if (e.target.closest("[data-show-projects]")) {
      tab = "projects";
      syncUrl();
      draw();
      return;
    }
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    activeTag = b.dataset.tag;
    syncUrl();
    draw();
    tagFilter.scrollIntoView({ block: "nearest" });
  });
  tagFilter.addEventListener("click", (e) => {
    if (!e.target.closest("[data-clear-tag]")) return;
    activeTag = "";
    syncUrl();
    draw();
  });
  bindProjectOpen(results, (id) => byId.get(id), (p) => owners.get(p.userId));

  /** The student's projects that match the search, each with the tags that matched. */
  function projectHighlights(u) {
    return (projectsByUser.get(u.id) ?? [])
      .filter((p) => matchesAny(projectText(p)))
      .map((p) => ({ title: p.title, tags: p.tags.filter((t) => matchesAny(t)).slice(0, 2) }));
  }

  draw();
}

function studentCardHtml(u, highlights = []) {
  return `
    <a class="student-card" href="#/profile/${esc(u.id)}">
      <div class="student-head">
        ${avatarHtml(u, 56)}
        <div>
          <h3>${esc(u.displayName)}</h3>
          ${u.discipline ? `<span class="tag">${esc(u.discipline)}</span>` : ""}
          ${u.school ? `<span class="card-school" title="${esc(u.school)}">${icons.school(13)}<span>${esc(u.school)}</span></span>` : ""}
        </div>
      </div>
      <p class="clamp-3 muted">${u.bio ? esc(u.bio) : "<em>No bio yet.</em>"}</p>
      ${
        highlights.length
          ? `<div class="card-matches">
               <span class="card-matches-label">Matching project${highlights.length === 1 ? "" : "s"}</span>
               ${highlights
                 .slice(0, 2)
                 .map((h) => `<span class="card-match">${esc(h.title)}${h.tags.map((t) => ` <span class="tag">${esc(t)}</span>`).join("")}</span>`)
                 .join("")}
               ${highlights.length > 2 ? `<span class="hint">+${highlights.length - 2} more</span>` : ""}
             </div>`
          : ""
      }
      <span class="card-cta">View portfolio ${icons.arrow(14)}</span>
    </a>`;
}
