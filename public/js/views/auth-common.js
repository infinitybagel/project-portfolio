// Shared bits for the auth pages.

const AUTH_CODES = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Please confirm your email first — check your inbox for the link we sent.",
  user_already_exists: "An account with this email already exists. Try logging in instead.",
  email_exists: "An account with this email already exists. Try logging in instead.",
  weak_password: "That password is too weak. Use at least 6 characters.",
  same_password: "Your new password must be different from the old one.",
  email_address_invalid: "That email address doesn't look right.",
  validation_failed: "Please check your email and password.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  signup_disabled: "New sign-ups are currently disabled.",
  email_provider_disabled: "Email sign-in isn't enabled for this Supabase project (Authentication → Providers → Email).",
};

const AUTH_MESSAGES = [
  [/invalid login credentials/i, AUTH_CODES.invalid_credentials],
  [/email not confirmed/i, AUTH_CODES.email_not_confirmed],
  [/already registered|already exists/i, AUTH_CODES.user_already_exists],
  [/password should be at least/i, AUTH_CODES.weak_password],
  [/invalid format|invalid email/i, AUTH_CODES.email_address_invalid],
  [/rate limit/i, AUTH_CODES.over_request_rate_limit],
  [/signups not allowed/i, AUTH_CODES.signup_disabled],
  [/failed to fetch|network/i, "Network error — check your connection and try again."],
];

export function authMessage(err) {
  if (err?.code && AUTH_CODES[err.code]) return AUTH_CODES[err.code];
  const msg = String(err?.message ?? "");
  for (const [pattern, friendly] of AUTH_MESSAGES) if (pattern.test(msg)) return friendly;
  return msg || "Something went wrong. Please try again.";
}

export function authShell(inner) {
  return `
    <div class="auth-wrap">
      <div class="auth-card card">${inner}</div>
    </div>`;
}
