// "/reset-password" — reached from a password-reset email link (user is signed in by the link).
import { supabase } from "../supabase.js";
import { navigate } from "../router.js";
import { state } from "../state.js";
import { setBusy, showFormError, toast } from "../ui.js";
import { authMessage, authShell } from "./auth-common.js";

export async function render(root) {
  root.innerHTML = authShell(`
    <h1>Set a new password</h1>
    <p class="muted">Choose a new password for ${state.user?.email ? `<strong></strong>` : "your account"}.</p>
    <form id="reset-form" class="form" novalidate>
      <div class="field">
        <label for="password">New password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required>
      </div>
      <div class="field">
        <label for="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autocomplete="new-password" required>
      </div>
      <p class="form-error" id="error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Update password</button>
    </form>`);

  const strong = root.querySelector("p.muted strong");
  if (strong) strong.textContent = state.user.email;

  const form = root.querySelector("#reset-form");
  const errorEl = root.querySelector("#error");
  const submit = form.querySelector('[type="submit"]');
  form.password.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = form.password.value;
    if (password.length < 6) return showFormError(errorEl, "Password must be at least 6 characters.");
    if (password !== form.confirm.value) return showFormError(errorEl, "Passwords don't match.");
    showFormError(errorEl, "");
    setBusy(submit, true, "Updating…");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showFormError(errorEl, authMessage(error));
      setBusy(submit, false);
      return;
    }
    state.recovery = false;
    toast("Password updated.", "success");
    navigate("/dashboard");
  });
}
