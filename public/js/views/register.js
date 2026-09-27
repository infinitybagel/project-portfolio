// "/register"
import { authRedirectUrl, supabase } from "../supabase.js";
import { navigate } from "../router.js";
import { state } from "../state.js";
import { DISCIPLINES, esc, readForm, setBusy, showFormError, toast } from "../ui.js";
import { authMessage, authShell } from "./auth-common.js";

export async function render(root) {
  root.innerHTML = authShell(`
    <h1>Create your portfolio</h1>
    <p class="muted">Showcase your engineering projects in minutes.</p>
    <form id="register-form" class="form" novalidate>
      <div class="field">
        <label for="displayName">Full name</label>
        <input id="displayName" name="displayName" autocomplete="name" maxlength="80" required>
      </div>
      <div class="field">
        <label for="discipline">Engineering discipline</label>
        <select id="discipline" name="discipline" required>
          <option value="">Select your discipline…</option>
          ${DISCIPLINES.map((d) => `<option>${esc(d)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required>
        </div>
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" autocomplete="new-password" required>
        </div>
      </div>
      <p class="hint">At least 6 characters.</p>
      <p class="form-error" id="error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Create account</button>
    </form>
    <p class="auth-alt">Already have an account? <a href="#/login">Log in</a></p>`);

  const form = root.querySelector("#register-form");
  const errorEl = root.querySelector("#error");
  const submit = form.querySelector('[type="submit"]');
  form.displayName.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { displayName, discipline, email } = readForm(form);
    const password = form.password.value;

    if (!displayName) return showFormError(errorEl, "Please enter your name.");
    if (!discipline) return showFormError(errorEl, "Please choose your engineering discipline.");
    if (!email) return showFormError(errorEl, "Please enter your email.");
    if (password.length < 6) return showFormError(errorEl, "Password must be at least 6 characters.");
    if (password !== form.confirm.value) return showFormError(errorEl, "Passwords don't match.");

    showFormError(errorEl, "");
    setBusy(submit, true, "Creating account…");
    state.busy = true; // this view decides where to go next, not the auth listener

    // The profile row is created by a database trigger from this metadata.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, discipline },
        emailRedirectTo: authRedirectUrl(),
      },
    });
    state.busy = false;

    if (error) {
      showFormError(errorEl, authMessage(error));
      setBusy(submit, false);
      return;
    }
    // With email confirmation on, an existing address returns a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      showFormError(errorEl, authMessage({ code: "user_already_exists" }));
      setBusy(submit, false);
      return;
    }

    if (data.session) {
      state.user = data.session.user;
      toast("Welcome! Your account is ready.", "success");
      navigate("/dashboard");
    } else {
      showCheckEmail(root, email);
    }
  });
}

function showCheckEmail(root, email) {
  root.innerHTML = authShell(`
    <p class="eyebrow">One more step</p>
    <h1>Check your email</h1>
    <p class="muted">We sent a confirmation link to <strong>${esc(email)}</strong>. Click it to activate your account. You'll be brought back here and signed in.</p>
    <div class="form">
      <button type="button" class="btn btn-secondary btn-block" id="resend">Resend email</button>
      <a class="btn btn-ghost btn-block" href="#/login">Back to log in</a>
    </div>`);
  const resend = root.querySelector("#resend");
  resend.addEventListener("click", async () => {
    setBusy(resend, true, "Sending…");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    setBusy(resend, false);
    toast(error ? authMessage(error) : "Confirmation email sent again.", error ? "error" : "success");
  });
}
