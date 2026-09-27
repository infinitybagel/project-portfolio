// Supabase (Postgres + Storage) data access for profiles and projects.
// Rows are mapped to camelCase objects so views stay backend-agnostic.
import { supabase } from "./supabase.js";

const PROFILE_COLUMNS =
  "id, display_name, email, discipline, school, bio, profile_picture_url, github_url, linkedin_url, youtube_url, resume_url, created_at";
const PROJECT_COLUMNS =
  "id, user_id, title, tags, description, image_url, project_link, github_link, cad_link, report_link, youtube_link, created_at";

const PROFILE_FIELDS = {
  displayName: "display_name",
  email: "email",
  discipline: "discipline",
  school: "school",
  bio: "bio",
  profilePictureUrl: "profile_picture_url",
  githubUrl: "github_url",
  linkedinUrl: "linkedin_url",
  youtubeUrl: "youtube_url",
  resumeUrl: "resume_url",
};
const PROJECT_FIELDS = {
  title: "title",
  tags: "tags",
  description: "description",
  projectLink: "project_link",
  githubLink: "github_link",
  cadLink: "cad_link",
  reportLink: "report_link",
  youtubeLink: "youtube_link",
};

const toProfile = (r) => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  discipline: r.discipline,
  school: r.school ?? "",
  bio: r.bio,
  profilePictureUrl: r.profile_picture_url,
  githubUrl: r.github_url,
  linkedinUrl: r.linkedin_url,
  youtubeUrl: r.youtube_url ?? "",
  resumeUrl: r.resume_url ?? "",
  createdAt: r.created_at,
});

const toProject = (r) => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  tags: r.tags ?? [],
  description: r.description,
  imageUrl: r.image_url,
  projectLink: r.project_link,
  githubLink: r.github_link,
  cadLink: r.cad_link,
  reportLink: r.report_link,
  youtubeLink: r.youtube_link ?? "",
  createdAt: r.created_at,
});

/** Maps only the camelCase keys present in `data` to column names. */
function toRow(data, fieldMap) {
  const row = {};
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) row[column] = data[key] ?? "";
  }
  return row;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Profiles ----------

export async function getUserProfile(uid) {
  const row = unwrap(await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", uid).maybeSingle());
  return row ? toProfile(row) : null;
}

export async function listUsers() {
  const rows = unwrap(
    await supabase.from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: false })
  );
  return rows.map(toProfile);
}

/** Creates or updates the signed-in user's profile row. */
export async function saveUserProfile(uid, data) {
  unwrap(await supabase.from("profiles").upsert({ id: uid, ...toRow(data, PROFILE_FIELDS) }));
}

export async function uploadProfilePicture(uid, blob) {
  return uploadFile("profile_pictures", uid, blob);
}

// ---------- Resumes ----------
// Stored as resumes/{uid}/{original file name}.pdf so links end in the real file name.
// (Resumes uploaded before this change live at resumes/{uid} and keep working.)

const RESUME_PREFIX = "/storage/v1/object/public/resumes/";

/** "My Résumé (final) v2.PDF" → "My_Resume_final_v2.pdf" — URL-safe, keeps the name recognizable. */
export function resumeFileName(name) {
  const base = String(name ?? "")
    .replace(/\.pdf$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return `${base || "resume"}.pdf`;
}

/** Storage path ("{uid}/Name.pdf" or legacy "{uid}") from a stored resume URL, or "". */
function resumePath(url) {
  try {
    const { pathname } = new URL(url);
    const i = pathname.indexOf(RESUME_PREFIX);
    return i === -1 ? "" : decodeURIComponent(pathname.slice(i + RESUME_PREFIX.length));
  } catch {
    return "";
  }
}

/** File name shown to people ("Aaron_Arnold_Resume.pdf"), or "" for legacy uploads without one. */
export function resumeDisplayName(url) {
  const path = resumePath(url);
  return path.includes("/") ? path.split("/").pop() : "";
}

/**
 * Link to show for a stored resume URL. On the deployed site this is a short same-domain
 * link (e.g. https://your-site.netlify.app/resumes/{uid}/Name.pdf) that Netlify proxies to
 * Supabase Storage (see netlify.toml). Local dev servers have no proxy, so they use the
 * direct Supabase URL.
 */
export function resumeLink(url) {
  const path = resumePath(url);
  if (!path) return url;
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (isLocal) return url.split("?")[0];
  return `${location.origin}/resumes/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Uploads (or replaces) the user's resume PDF, removes the previous file, returns its public URL. */
export async function uploadResume(uid, file, previousUrl = "") {
  const path = `${uid}/${resumeFileName(file.name)}`;
  // max-age=0: same-name re-uploads must show up immediately, and the link carries no version query.
  const url = await uploadFile("resumes", path, file, { contentType: "application/pdf", cacheControl: "0", version: false });
  const oldPath = resumePath(previousUrl);
  if (oldPath && oldPath !== path) {
    await deleteFile("resumes", oldPath).catch((err) => console.warn("Old resume not removed", err));
  }
  return url;
}

export async function deleteResume(currentUrl) {
  const path = resumePath(currentUrl);
  if (path) await deleteFile("resumes", path);
}

// ---------- Projects ----------

export async function listProjectsByUser(uid) {
  const rows = unwrap(
    await supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
  );
  return rows.map(toProject);
}

export async function listRecentProjects(max = 100) {
  const rows = unwrap(
    await supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(max)
  );
  return rows.map(toProject);
}

/**
 * Inserts the project row first (Storage policies verify ownership through it),
 * then uploads the image and stores its URL.
 */
export async function createProject(uid, fields, imageBlob) {
  const { id } = unwrap(
    await supabase
      .from("projects")
      .insert({ ...toRow(fields, PROJECT_FIELDS), user_id: uid })
      .select("id")
      .single()
  );
  if (imageBlob) {
    const imageUrl = await uploadFile("project_images", id, imageBlob);
    unwrap(await supabase.from("projects").update({ image_url: imageUrl }).eq("id", id));
  }
  return id;
}

export async function updateProject(project, fields, { imageBlob = null, removeImage = false } = {}) {
  const row = toRow(fields, PROJECT_FIELDS);
  if (imageBlob) {
    row.image_url = await uploadFile("project_images", project.id, imageBlob);
  } else if (removeImage && project.imageUrl) {
    await deleteFile("project_images", project.id);
    row.image_url = "";
  }
  unwrap(await supabase.from("projects").update(row).eq("id", project.id));
}

export async function deleteProject(project) {
  // Remove the image while the row still exists — Storage policies check ownership through it.
  if (project.imageUrl) await deleteFile("project_images", project.id);
  unwrap(await supabase.from("projects").delete().eq("id", project.id));
}

// ---------- Storage helpers ----------

async function uploadFile(
  bucket,
  path,
  blob,
  { contentType = blob.type || "image/jpeg", cacheControl = "3600", version = true } = {}
) {
  unwrap(await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType, cacheControl }));
  const { publicUrl } = supabase.storage.from(bucket).getPublicUrl(path).data;
  // Image paths are reused when an image is replaced, so version the URL to bust caches.
  return version ? `${publicUrl}?v=${Date.now()}` : publicUrl;
}

async function deleteFile(bucket, path) {
  unwrap(await supabase.storage.from(bucket).remove([path]));
}
