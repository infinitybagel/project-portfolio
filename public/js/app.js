import { isConfigured, supabase } from "./supabase.js";
import { currentRoute, navigate, setRenderer } from "./router.js";
import { state } from "./state.js";
import { emptyState, loadingHtml } from "./components.js";
import { esc, friendlyError, initModal, toast } from "./ui.js";
import * as explore from "./views/explore.js";
import * as profile from "./views/profile.js";
import * as login from "./views/login.js";
import * as register from "./views/register.js";
import * as dashboard from "./views/dashboard.js";
import * as resetPassword from "./views/reset-password.js";

const routes = [
  { pattern: /^\/(?:explore)?$/, view: explore, nav: "explore" },
  { pattern: /^\/profile\/([A-Za-z0-9_-]+)$/, view: profile, nav: "profile" },
  { pattern: /^\/login$/, view: login, guestOnly: true, title: "Log in" },
  { pattern: /^\/register$/, view: register, guestOnly: true, title: "Sign up" },
  { pattern: /^\/dashboard$/, view: dashboard, requiresAuth: true, nav: "dashboard", title: "Dashboard" },
  { pattern: /^\/reset-password$/, view: resetPassword, requiresAuth: true, title: "Reset password" },
];

const appEl = document.getElementById("app");
let renderId = 0;

async function router() {
  const id = ++renderId;
  const { path, query } = currentRoute();

  let route = null;
  let match = null;
  for (const r of routes) {
    match = path.match(r.pattern);
    if (match) {
      route = r;
      break;
    }
  }

  if (route?.requiresAuth && !state.user) {
    navigate(`/login?next=${encodeURIComponent(path)}`);
    return;
  }
  if (route?.guestOnly && state.user) {
    const next = query.get("next");
    navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    return;
  }

  renderNav(route?.nav, path);
  document.title = route?.title ? `${route.title} · Blueprint` : "Blueprint · Engineering Student Portfolios";
  window.scrollTo(0, 0);

  if (!route) {
    appEl.innerHTML = emptyState({
      title: "Page not found",
      body: "The page you're looking for doesn't exist.",
      action: `<a class="btn btn-primary" href="#/explore">Go to directory</a>`,
    });
    return;
  }

  appEl.innerHTML = loadingHtml;
  const ctx = { params: match.slice(1), query, isCurrent: () => id === renderId };
  try {
    await route.view.render(appEl, ctx);
  } catch (err) {
    console.error(err);
    if (!ctx.isCurrent()) return;
    appEl.innerHTML = emptyState({
      title: "Couldn't load this page",
      body: friendlyError(err),
      action: `<button class="btn btn-primary" type="button" onclick="location.reload()">Retry</button>`,
    });
  }
}

function renderNav(active, path) {
  const nav = document.getElementById("nav-links");
  const link = (href, label, key) =>
    `<a href="${href}" class="nav-link${active === key ? " active" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;

  if (state.user) {
    const ownProfile = path === `/profile/${state.user.id}`;
    nav.innerHTML = `
      ${link("#/explore", "Explore", "explore")}
      ${link("#/dashboard", "Dashboard", "dashboard")}
      <a href="#/profile/${esc(state.user.id)}" class="nav-link${ownProfile ? " active" : ""}">My profile</a>
      <button type="button" class="btn btn-secondary btn-sm" id="logout">Log out</button>`;
    nav.querySelector("#logout").addEventListener("click", async () => {
      const { error } = await supabase.auth.signOut();
      if (error) return toast(friendlyError(error), "error");
      state.user = null;
      toast("You've been logged out.");
      navigate("/explore");
    });
  } else {
    nav.innerHTML = `
      ${link("#/explore", "Explore", "explore")}
      <a href="#/login" class="nav-link${path === "/login" ? " active" : ""}">Log in</a>
      <a href="#/register" class="btn btn-primary btn-sm">Sign up</a>`;
  }
  document.body.classList.remove("nav-open");
}

function renderSetup() {
  document.getElementById("nav-links").innerHTML = "";
  appEl.innerHTML = `
    <section class="card setup">
      <p class="eyebrow">Setup required</p>
      <h1>Connect your Supabase project</h1>
      <p class="muted">The app is running, but it needs your Supabase project URL and anon key before it can store accounts, profiles and projects.</p>
      <ol>
        <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">supabase.com/dashboard</a>.</li>
        <li>Open <strong>SQL Editor</strong>, paste the contents of <code>supabase/schema.sql</code> and click <strong>Run</strong>. This creates the tables, security policies and storage buckets.</li>
        <li>Under <strong>Authentication → URL Configuration</strong>, add this site's URL (e.g. <code>${esc(location.origin + location.pathname)}</code>) to the redirect URLs.</li>
        <li>Copy the <strong>Project URL</strong> and <strong>anon public key</strong> from <strong>Project Settings → API</strong>.</li>
        <li>Paste them into <code>public/js/supabase-config.js</code> and reload.</li>
      </ol>
      <p class="muted small">See README.md for full details.</p>
    </section>`;
}

// ---------- Boot ----------

initModal();
document.querySelector(".nav-toggle").addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  document.querySelector(".nav-toggle").setAttribute("aria-expanded", String(open));
});

if (!isConfigured) {
  renderSetup();
} else {
  setRenderer(router);
  window.addEventListener("hashchange", router);
  // Defer handling: Supabase warns against awaiting its own calls inside this callback.
  supabase.auth.onAuthStateChange((event, session) => setTimeout(() => handleAuth(event, session), 0));
}

function handleAuth(event, session) {
  const user = session?.user ?? null;
  const userChanged = (user?.id ?? null) !== (state.user?.id ?? null);
  state.user = user;

  if (event === "PASSWORD_RECOVERY") {
    state.recovery = true;
    if (state.authReady) navigate("/reset-password");
    return;
  }
  if (event === "INITIAL_SESSION") {
    state.authReady = true;
    consumeAuthRedirectParams();
    if (state.recovery) navigate("/reset-password");
    else router();
    return;
  }
  if (state.authReady && userChanged && !state.busy) router();
}

/** Removes ?code= / ?error= left by email links, surfacing any error to the user. */
function consumeAuthRedirectParams() {
  const url = new URL(location.href);
  const errorDescription = url.searchParams.get("error_description");
  if (errorDescription) toast(errorDescription.replace(/\+/g, " "), "error");
  let changed = false;
  for (const key of ["code", "error", "error_code", "error_description"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) history.replaceState(null, "", url.pathname + url.search + url.hash);
}
