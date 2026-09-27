// Supabase (Postgres + Storage) data access for profiles and projects.
// Rows are mapped to camelCase objects so views stay backend-agnostic.
import { supabase } from "./supabase.js";

const PROFILE_COLUMNS =
  "id, display_name, email, discipline, bio, profile_picture_url, github_url, linkedin_url, youtube_url, created_at";
const PROJECT_COLUMNS =
  "id, user_id, title, tags, description, image_url, project_link, github_link, cad_link, report_link, youtube_link, created_at";

const PROFILE_FIELDS = {
  displayName: "display_name",
  email: "email",
  discipline: "discipline",
  bio: "bio",
  profilePictureUrl: "profile_picture_url",
  githubUrl: "github_url",
  linkedinUrl: "linkedin_url",
  youtubeUrl: "youtube_url",
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
  bio: r.bio,
  profilePictureUrl: r.profile_picture_url,
  githubUrl: r.github_url,
  linkedinUrl: r.linkedin_url,
  youtubeUrl: r.youtube_url ?? "",
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
  return uploadImage("profile_pictures", uid, blob);
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
    const imageUrl = await uploadImage("project_images", id, imageBlob);
    unwrap(await supabase.from("projects").update({ image_url: imageUrl }).eq("id", id));
  }
  return id;
}

export async function updateProject(project, fields, { imageBlob = null, removeImage = false } = {}) {
  const row = toRow(fields, PROJECT_FIELDS);
  if (imageBlob) {
    row.image_url = await uploadImage("project_images", project.id, imageBlob);
  } else if (removeImage && project.imageUrl) {
    await deleteImage("project_images", project.id);
    row.image_url = "";
  }
  unwrap(await supabase.from("projects").update(row).eq("id", project.id));
}

export async function deleteProject(project) {
  // Remove the image while the row still exists — Storage policies check ownership through it.
  if (project.imageUrl) await deleteImage("project_images", project.id);
  unwrap(await supabase.from("projects").delete().eq("id", project.id));
}

// ---------- Storage helpers ----------

async function uploadImage(bucket, path, blob) {
  unwrap(
    await supabase.storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600",
    })
  );
  const { publicUrl } = supabase.storage.from(bucket).getPublicUrl(path).data;
  // The path is reused when an image is replaced, so version the URL to bust caches.
  return `${publicUrl}?v=${Date.now()}`;
}

async function deleteImage(bucket, path) {
  unwrap(await supabase.storage.from(bucket).remove([path]));
}
