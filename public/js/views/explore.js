// Public directory: "/" and "/explore"
import { listRecentProjects, listUsers } from "../data.js";
import { avatarHtml, bindProjectOpen, emptyState, icons, projectCardHtml } from "../components.js";
import { state } from "../state.js";
import { esc } from "../ui.js";

export async function render(root, ctx) {
  const [users, projects] = await Promise.all([listUsers(), listRecentProjects(100)]);
  if (!ctx.isCurrent()) return;

  const owners = new Map(users.map((u) => [u.id, u]));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const disciplines = [...new Set(users.map((u) => u.discipline).filter(Boolean))].sort();

  let activeTag = ctx.query.get("tag") || "";
  let tab = ctx.query.get("tab") === "projects" || activeTag ? "projects" : "students";
  let search = "";
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
        <div><dt>Disciplines</dt><dd>${disciplines.length}</dd></div>
      </dl>
    </section>

    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Browse">
        <button role="tab" type="button" data-tab="students">Students</button>
        <button role="tab" type="button" data-tab="projects">Projects</button>
      </div>
      <label class="search">
        ${icons.search(16)}
        <input type="search" id="search" placeholder="Search names, projects, skills…" aria-label="Search">
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

  const matches = (text) => !search || text.toLowerCase().includes(search);

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
      const list = users.filter(
        (u) =>
          (!discipline || u.discipline === discipline) &&
          matches(`${u.displayName} ${u.discipline} ${u.bio}`)
      );
      results.innerHTML = list.length
        ? `<div class="grid grid-students">${list.map(studentCardHtml).join("")}</div>`
        : users.length
          ? emptyState({ title: "No students match", body: "Try a different search or discipline." })
          : emptyState({
              title: "No portfolios yet",
              body: "Be the first engineering student to publish a portfolio.",
              action: state.user ? "" : `<a class="btn btn-primary" href="#/register">Create your portfolio</a>`,
            });
    } else {
      const list = projects.filter((p) => {
        const owner = owners.get(p.userId);
        return (
          (!discipline || owner?.discipline === discipline) &&
          hasTag(p) &&
          matches(`${p.title} ${p.tags.join(" ")} ${p.description} ${owner?.displayName ?? ""}`)
        );
      });
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
    search = e.target.value.trim().toLowerCase();
    draw();
  });
  results.addEventListener("click", (e) => {
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

  draw();
}

function studentCardHtml(u) {
  return `
    <a class="student-card" href="#/profile/${esc(u.id)}">
      <div class="student-head">
        ${avatarHtml(u, 56)}
        <div>
          <h3>${esc(u.displayName)}</h3>
          ${u.discipline ? `<span class="tag">${esc(u.discipline)}</span>` : ""}
        </div>
      </div>
      <p class="clamp-3 muted">${u.bio ? esc(u.bio) : "<em>No bio yet.</em>"}</p>
      <span class="card-cta">View portfolio ${icons.arrow(14)}</span>
    </a>`;
}
