// Minimal hash router plumbing shared by app.js and views.
let rerender = () => {};

export function setRenderer(fn) {
  rerender = fn;
}

export function currentRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(qs) };
}

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash === target) rerender();
  else location.hash = target;
}
