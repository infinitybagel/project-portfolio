// "/login"
import { authRedirectUrl, supabase } from "../supabase.js";
import { readForm, setBusy, showFormError, toast } from "../ui.js";
import { authMessage, authShell } from "./auth-common.js";

export async function render(root, ctx) {
  const next = ctx.query.get("next");
  root.innerHTML = authShell(`
    <h1>Welcome back</h1>
    <p class="muted">Log in to manage your engineering portfolio.</p>
    <form id="login-form" class="form" novalidate>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="field">
        <div class="label-row">
          <label for="password">Password</label>
          <button type="button" class="text-btn" id="forgot">Forgot password?</button>
        </div>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <p class="form-error" id="error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
    <p class="auth-alt">New here? <a href="#/register${next ? `?next=${encodeURIComponent(next)}` : ""}">Create an account</a></p>`);

  const form = root.querySelector("#login-form");
  const errorEl = root.querySelector("#error");
  const submit = form.querySelector('[type="submit"]');
  form.email.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email } = readForm(form);
    const password = form.password.value;
    if (!email || !password) return showFormError(errorEl, "Please enter your email and password.");
    showFormError(errorEl, "");
    setBusy(submit, true, "Logging in…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showFormError(errorEl, authMessage(error));
      setBusy(submit, false);
    }
    // On success the auth listener in app.js redirects to ?next or the dashboard.
  });

  root.querySelector("#forgot").addEventListener("click", async () => {
    const { email } = readForm(form);
    if (!email) {
      showFormError(errorEl, "Enter your email above, then click “Forgot password?” again.");
      form.email.focus();
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    if (error) return showFormError(errorEl, authMessage(error));
    showFormError(errorEl, "");
    toast(`If an account exists for ${email}, a reset link is on its way.`, "success");
  });
}
