// Protected "/dashboard": edit profile + create/update/delete projects.
import {
  createProject,
  deleteProject,
  getUserProfile,
  listProjectsByUser,
  saveUserProfile,
  updateProject,
  uploadProfilePicture,
} from "../data.js";
import { avatarHtml, bindProjectOpen, emptyState, icons, projectCardHtml } from "../components.js";
import { state } from "../state.js";
import { createTagInput } from "../tag-input.js";
import {
  DISCIPLINES,
  closeModal,
  confirmDialog,
  esc,
  friendlyError,
  normalizeUrl,
  normalizeYouTubeUrl,
  openModal,
  prepareImage,
  readForm,
  safeUrl,
  setBusy,
  showFormError,
  toast,
} from "../ui.js";

export async function render(root, ctx) {
  const user = state.user;
  const uid = user.id;
  let [profile, projects] = await Promise.all([getUserProfile(uid), listProjectsByUser(uid)]);
  if (!ctx.isCurrent()) return;

  let profileExists = Boolean(profile);
  profile ??= {
    id: uid,
    displayName: user.user_metadata?.display_name || "",
    email: user.email,
    discipline: "",
    bio: "",
    profilePictureUrl: "",
    githubUrl: "",
    linkedinUrl: "",
    youtubeUrl: "",
  };

  const firstName = (profile.displayName || "there").split(" ")[0];
  const disciplineOptions = DISCIPLINES.includes(profile.discipline) || !profile.discipline
    ? DISCIPLINES
    : [profile.discipline, ...DISCIPLINES];

  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>Welcome, ${esc(firstName)}</h1>
      </div>
      <a class="btn btn-secondary" href="#/profile/${esc(uid)}">View public profile ${icons.arrow(15)}</a>
    </div>

    ${
      profileExists
        ? ""
        : `<div class="notice">Your profile isn't published yet. Fill in your details and save to appear in the directory.</div>`
    }

    <section class="card profile-header profile-editor" aria-labelledby="profile-heading">
      <div class="avatar-column">
        <div id="avatar-preview">${avatarHtml(profile, 112)}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="avatar-btn">${icons.image(15)}Upload photo</button>
        <input type="file" id="avatar-input" accept="image/*" hidden>
        <p class="hint">JPG, PNG or WebP, up to 5 MB.</p>
      </div>
      <form id="profile-form" class="form profile-info" novalidate>
        <h2 id="profile-heading">Your profile</h2>
        <div class="field-row">
          <div class="field">
            <label for="p-name">Full name</label>
            <input id="p-name" name="displayName" maxlength="80" value="${esc(profile.displayName)}" required>
          </div>
          <div class="field">
            <label for="p-discipline">Engineering discipline</label>
            <select id="p-discipline" name="discipline">
              <option value="">Select…</option>
              ${disciplineOptions
                .map((d) => `<option ${d === profile.discipline ? "selected" : ""}>${esc(d)}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <div class="field bio-field">
          <div class="label-row">
            <label for="p-bio">Short bio</label>
            <span class="hint" id="bio-count"></span>
          </div>
          <!-- Same text width, font and line breaks as .profile-bio on the public profile -->
          <textarea id="p-bio" class="bio-editor" name="bio" rows="3" maxlength="1000" placeholder="Year, school, interests, what you're looking for…">${esc(profile.bio)}</textarea>
          <p class="hint">Line breaks and wrapping appear exactly like this on your public profile.</p>
        </div>
        <div class="field-row field-row-3">
          <div class="field">
            <label for="p-github">GitHub</label>
            <input id="p-github" name="githubUrl" inputmode="url" placeholder="github.com/username" value="${esc(profile.githubUrl)}">
          </div>
          <div class="field">
            <label for="p-linkedin">LinkedIn</label>
            <input id="p-linkedin" name="linkedinUrl" inputmode="url" placeholder="linkedin.com/in/username" value="${esc(profile.linkedinUrl)}">
          </div>
          <div class="field">
            <label for="p-youtube">YouTube channel</label>
            <input id="p-youtube" name="youtubeUrl" inputmode="url" placeholder="youtube.com/@yourchannel" value="${esc(profile.youtubeUrl)}">
          </div>
        </div>
        <p class="form-error" id="profile-error" role="alert" hidden></p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Save profile</button>
        </div>
      </form>
    </section>

    <section class="dash-projects" aria-labelledby="projects-heading">
      <div class="section-head">
        <h2 id="projects-heading">Your projects <span class="count" id="project-count"></span></h2>
        <button type="button" class="btn btn-primary" id="new-project">${icons.plus(16)}New project</button>
      </div>
      <div id="project-list"></div>
    </section>`;

  // ---------- Profile form ----------

  const form = root.querySelector("#profile-form");
  const profileError = root.querySelector("#profile-error");
  const avatarInput = root.querySelector("#avatar-input");
  const avatarPreview = root.querySelector("#avatar-preview");
  const bioCount = root.querySelector("#bio-count");
  let pendingAvatar = null;

  const updateBioCount = () => (bioCount.textContent = `${form.bio.value.length}/1000`);
  // Grow with the content (no inner scrollbar) so the box mirrors the public bio's height too.
  const fitBio = () => {
    form.bio.style.height = "auto";
    form.bio.style.height = `${form.bio.scrollHeight + form.bio.offsetHeight - form.bio.clientHeight}px`;
  };
  form.bio.addEventListener("input", () => {
    updateBioCount();
    fitBio();
  });
  updateBioCount();
  fitBio();
  // Re-fit when the column width changes (window resize) since the text re-wraps.
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width !== lastWidth) {
      lastWidth = width;
      fitBio();
    }
  }).observe(form);

  root.querySelector("#avatar-btn").addEventListener("click", () => avatarInput.click());
  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    avatarInput.value = "";
    if (!file) return;
    try {
      pendingAvatar = await prepareImage(file, 512);
      const url = URL.createObjectURL(pendingAvatar);
      avatarPreview.innerHTML = `<img class="avatar" src="${url}" alt="New profile photo preview" style="width:112px;height:112px">`;
      toast("Photo ready — click Save profile to upload it.");
    } catch (err) {
      showFormError(profileError, err.message);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = readForm(form);
    if (!values.displayName) return showFormError(profileError, "Please enter your name.");
    const githubUrl = normalizeUrl(values.githubUrl);
    const linkedinUrl = normalizeUrl(values.linkedinUrl);
    if (githubUrl === null) return showFormError(profileError, "The GitHub link isn't a valid URL.");
    if (linkedinUrl === null) return showFormError(profileError, "The LinkedIn link isn't a valid URL.");
    const youtubeUrl = normalizeYouTubeUrl(values.youtubeUrl);
    if (youtubeUrl === null) return showFormError(profileError, "The YouTube link must be a youtube.com or youtu.be URL.");

    showFormError(profileError, "");
    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, "Saving…");
    try {
      const data = {
        displayName: values.displayName,
        email: user.email,
        discipline: values.discipline,
        bio: values.bio,
        githubUrl,
        linkedinUrl,
        youtubeUrl,
      };
      if (pendingAvatar) {
        data.profilePictureUrl = await uploadProfilePicture(uid, pendingAvatar);
        pendingAvatar = null;
      }
      await saveUserProfile(uid, data);
      profileExists = true;
      Object.assign(profile, data);
      form.githubUrl.value = githubUrl;
      form.linkedinUrl.value = linkedinUrl;
      form.youtubeUrl.value = youtubeUrl;
      root.querySelector(".notice")?.remove();
      toast("Profile saved.", "success");
    } catch (err) {
      console.error(err);
      showFormError(profileError, friendlyError(err));
    } finally {
      setBusy(submit, false);
    }
  });

  // ---------- Projects ----------

  const list = root.querySelector("#project-list");
  const findProject = (id) => projects.find((p) => p.id === id);

  function drawProjects() {
    root.querySelector("#project-count").textContent = projects.length;
    list.innerHTML = projects.length
      ? `<div class="grid grid-projects grid-dash">${projects
          .map((p) => projectCardHtml(p, { actions: true }))
          .join("")}</div>`
      : emptyState({
          title: "No projects yet",
          body: "Add CAD models, circuits, code, research — anything you've built or designed.",
          action: `<button type="button" class="btn btn-primary" data-new>${icons.plus(16)}Add your first project</button>`,
        });
  }

  async function refreshProjects() {
    projects = await listProjectsByUser(uid);
    if (ctx.isCurrent()) drawProjects();
  }

  const saveProfileFirst = () => {
    if (profileExists) return false;
    toast("Save your profile first so your projects have an owner page.", "error");
    form.displayName.focus();
    return true;
  };

  root.querySelector("#new-project").addEventListener("click", () => {
    if (!saveProfileFirst()) openProjectForm(null);
  });

  list.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) {
      if (!saveProfileFirst()) openProjectForm(null);
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) return openProjectForm(findProject(editBtn.dataset.edit));

    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const project = findProject(delBtn.dataset.delete);
      if (!project) return;
      const ok = await confirmDialog({
        title: "Delete project?",
        message: `“${project.title}” and its image will be permanently removed from your portfolio.`,
        confirmLabel: "Delete project",
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteProject(project);
        projects = projects.filter((p) => p.id !== project.id);
        drawProjects();
        toast("Project deleted.", "success");
      } catch (err) {
        console.error(err);
        toast(friendlyError(err), "error");
      }
    }
  });
  bindProjectOpen(list, findProject);

  function openProjectForm(project) {
    const isEdit = Boolean(project);
    const p = project || {};
    let imageBlob = null;
    let removeImage = false;
    const currentImage = safeUrl(p.imageUrl);

    const d = openModal(
      `<button class="modal-close" type="button" data-close aria-label="Close">${icons.x(18)}</button>
       <form id="project-form" class="form modal-form" novalidate>
         <h2>${isEdit ? "Edit project" : "New project"}</h2>
         <div class="field">
           <label for="f-title">Project title</label>
           <input id="f-title" name="title" maxlength="120" required value="${esc(p.title)}" placeholder="e.g. 6-DOF robotic arm">
         </div>
         <div class="field">
           <label for="f-tags">Topic tags</label>
           <div id="tag-editor"></div>
         </div>
         <div class="field">
           <div class="label-row">
             <label for="f-desc">Description / methodology</label>
             <span class="hint" id="desc-count"></span>
           </div>
           <textarea id="f-desc" name="description" rows="6" maxlength="5000" placeholder="The problem, your approach, tools used, results…">${esc(p.description)}</textarea>
         </div>
         <div class="field">
           <span class="label">Project image</span>
           <div class="image-drop" id="image-drop">
             <div id="image-preview">${currentImage ? `<img src="${esc(currentImage)}" alt="">` : `<span class="muted">${icons.image(22)}<br>No image</span>`}</div>
             <div class="image-drop-actions">
               <button type="button" class="btn btn-secondary btn-sm" id="img-btn">${currentImage ? "Replace image" : "Upload image"}</button>
               <button type="button" class="btn btn-ghost btn-sm btn-danger-text" id="img-remove" ${currentImage ? "" : "hidden"}>Remove</button>
               <p class="hint">Hardware photo, CAD render or screenshot. Up to 5 MB.</p>
             </div>
             <input type="file" id="img-input" accept="image/*" hidden>
           </div>
         </div>
         <fieldset class="links-fieldset">
           <legend>Relevant links <span class="hint">(optional)</span></legend>
           <div class="field-row">
             <div class="field"><label for="f-link">Project page / demo</label><input id="f-link" name="projectLink" inputmode="url" value="${esc(p.projectLink)}" placeholder="https://…"></div>
             <div class="field"><label for="f-gh">GitHub repository</label><input id="f-gh" name="githubLink" inputmode="url" value="${esc(p.githubLink)}" placeholder="github.com/…"></div>
           </div>
           <div class="field-row">
             <div class="field"><label for="f-cad">CAD repository</label><input id="f-cad" name="cadLink" inputmode="url" value="${esc(p.cadLink)}" placeholder="Onshape, GrabCAD, Drive…"></div>
             <div class="field"><label for="f-report">Report</label><input id="f-report" name="reportLink" inputmode="url" value="${esc(p.reportLink)}" placeholder="PDF or doc link"></div>
           </div>
           <div class="field">
             <label for="f-youtube">YouTube video</label>
             <input id="f-youtube" name="youtubeLink" inputmode="url" value="${esc(p.youtubeLink)}" placeholder="youtube.com/watch?v=… or youtu.be/…">
             <p class="hint">Demo or walkthrough. Video links play right inside the project page.</p>
           </div>
         </fieldset>
         <p class="form-error" id="project-error" role="alert" hidden></p>
         <div class="modal-actions">
           <button type="button" class="btn btn-ghost" data-close>Cancel</button>
           <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Add project"}</button>
         </div>
       </form>`,
      { size: "lg", label: isEdit ? "Edit project" : "New project" }
    );

    const pf = d.querySelector("#project-form");
    const errEl = d.querySelector("#project-error");
    const preview = d.querySelector("#image-preview");
    const imgInput = d.querySelector("#img-input");
    const imgBtn = d.querySelector("#img-btn");
    const imgRemove = d.querySelector("#img-remove");
    const tagEditor = createTagInput(d.querySelector("#tag-editor"), p.tags || []);
    const descCount = d.querySelector("#desc-count");
    const updateDescCount = () => (descCount.textContent = `${pf.description.value.length}/5000`);
    pf.description.addEventListener("input", updateDescCount);
    updateDescCount();
    pf.title.focus();

    imgBtn.addEventListener("click", () => imgInput.click());
    imgInput.addEventListener("change", async () => {
      const file = imgInput.files[0];
      imgInput.value = "";
      if (!file) return;
      try {
        imageBlob = await prepareImage(file, 1600);
        removeImage = false;
        preview.innerHTML = `<img src="${URL.createObjectURL(imageBlob)}" alt="">`;
        imgBtn.textContent = "Replace image";
        imgRemove.hidden = false;
        showFormError(errEl, "");
      } catch (err) {
        showFormError(errEl, err.message);
      }
    });
    imgRemove.addEventListener("click", () => {
      imageBlob = null;
      removeImage = true;
      preview.innerHTML = `<span class="muted">${icons.image(22)}<br>No image</span>`;
      imgBtn.textContent = "Upload image";
      imgRemove.hidden = true;
    });

    pf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = readForm(pf);
      if (!v.title) return showFormError(errEl, "Please give your project a title.");

      const fields = { title: v.title, tags: tagEditor.getTags(), description: v.description };
      const linkLabels = { projectLink: "Project page", githubLink: "GitHub", cadLink: "CAD repository", reportLink: "Report" };
      for (const [key, label] of Object.entries(linkLabels)) {
        const url = normalizeUrl(v[key]);
        if (url === null) return showFormError(errEl, `The ${label} link isn't a valid URL.`);
        fields[key] = url;
      }
      const youtubeLink = normalizeYouTubeUrl(v.youtubeLink);
      if (youtubeLink === null) return showFormError(errEl, "The YouTube link must be a youtube.com or youtu.be URL.");
      fields.youtubeLink = youtubeLink;

      showFormError(errEl, "");
      const submit = pf.querySelector('[type="submit"]');
      setBusy(submit, true, imageBlob ? "Uploading…" : "Saving…");
      try {
        if (isEdit) {
          await updateProject(project, fields, { imageBlob, removeImage });
          toast("Project updated.", "success");
        } else {
          await createProject(uid, fields, imageBlob);
          toast("Project added to your portfolio.", "success");
        }
        closeModal();
        await refreshProjects();
      } catch (err) {
        console.error(err);
        showFormError(errEl, friendlyError(err));
        setBusy(submit, false);
        // A new project's doc may exist even if its image upload failed.
        if (!isEdit) refreshProjects();
      }
    });
  }

  drawProjects();
}
