// Generic UI helpers: escaping, URLs, toasts, modals, forms, images.

export const DISCIPLINES = [
  "Aerospace",
  "Biomedical",
  "Chemical",
  "Civil",
  "Computer",
  "Electrical",
  "Environmental",
  "Industrial",
  "Materials",
  "Mechanical",
  "Mechatronics",
  "Software",
  "Other",
];

export const PROJECT_CATEGORIES = [
  "CAD Design",
  "Embedded Systems",
  "Structural Analysis",
  "Circuit / PCB Design",
  "Robotics",
  "Controls",
  "Simulation / FEA",
  "CFD",
  "Machine Learning",
  "Software / Web App",
  "Biomechanics",
  "Materials Testing",
  "Research",
  "Capstone / Senior Design",
];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Returns an http(s) URL safe to put in an href, or "" if the value isn't one. */
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/** Normalizes user-typed links ("github.com/me" → "https://github.com/me"). Returns null if invalid. */
export function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = safeUrl(withScheme);
  return url && url.includes(".") ? url : null;
}

export function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Trimmed string values from a form. */
export function readForm(form) {
  const out = {};
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string") out[key] = value.trim();
  }
  return out;
}

export function setBusy(button, busy, busyLabel = "Saving…") {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(busyLabel)}`;
    button.disabled = true;
  } else {
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    button.disabled = false;
  }
}

export function showFormError(el, message) {
  el.textContent = message || "";
  el.hidden = !message;
}

/** Turns Supabase (PostgREST / Storage) errors into user-facing messages. */
export function friendlyError(err) {
  const code = String(err?.code ?? err?.statusCode ?? "");
  const msg = String(err?.message ?? "");
  if (code === "PGRST205" || code === "42P01" || /could not find the table|does not exist/i.test(msg))
    return "The database isn't set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
  if (/bucket not found/i.test(msg))
    return "Storage buckets are missing. Run supabase/schema.sql in the Supabase SQL Editor.";
  if (code === "42501" || code === "403" || /row-level security|permission denied|unauthorized/i.test(msg))
    return "You don't have permission to do that. Try logging out and back in.";
  if (code === "23514") return "One of the fields is too long or not in a valid format.";
  if (/exceeded the maximum allowed size|payload too large/i.test(msg)) return "Image must be under 5 MB.";
  if (/mime type/i.test(msg)) return "Please upload an image file.";
  if (/failed to fetch|networkerror|network request failed/i.test(msg))
    return "Network error — check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

// ---------- Toasts ----------

export function toast(message, kind = "info") {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, kind === "error" ? 6000 : 3200);
}

// ---------- Modal ----------

const dialog = () => document.getElementById("modal");

export function openModal(html, { size = "md", label = "Dialog" } = {}) {
  const d = dialog();
  d.className = `modal modal-${size}`;
  d.setAttribute("aria-label", label);
  d.innerHTML = `<div class="modal-inner">${html}</div>`;
  d.returnValue = "";
  if (!d.open) d.showModal();
  return d;
}

export function closeModal(value = "") {
  const d = dialog();
  if (d.open) d.close(value);
}

export function initModal() {
  const d = dialog();
  // Click on the backdrop (the dialog element itself, outside .modal-inner) closes it.
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
    if (e.target.closest("[data-close]")) d.close();
  });
  d.addEventListener("close", () => {
    setTimeout(() => {
      if (!d.open) d.innerHTML = "";
    }, 0);
  });
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const d = openModal(
      `<form method="dialog" class="confirm">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" value="cancel">Cancel</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" value="ok" autofocus>${esc(confirmLabel)}</button>
        </div>
      </form>`,
      { size: "sm", label: title }
    );
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    // Button clicks resolve via submit (synchronous); Esc/backdrop resolve via close.
    d.querySelector("form").addEventListener("submit", (e) => finish(e.submitter?.value === "ok"));
    d.addEventListener("close", () => finish(d.returnValue === "ok"), { once: true });
  });
}

// ---------- Images ----------

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Validates an image file and downsizes it in the browser so uploads stay small.
 * Throws an Error with a user-facing message if the file is unusable.
 */
export async function prepareImage(file, maxDim = 1600) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be under 5 MB.");
    return file;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try a JPG, PNG or WebP.");
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_UPLOAD_BYTES && file.size < 1.5 * 1024 * 1024) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.86));
  if (!blob) throw new Error("That image couldn't be processed.");
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("Image must be under 5 MB.");
  return blob;
}
