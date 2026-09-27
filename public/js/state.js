// Shared app state.
export const state = {
  user: null, // Supabase Auth user, or null when signed out
  authReady: false, // true once Supabase has reported the initial session
  busy: false, // suppresses auth-triggered re-renders during multi-step flows (e.g. registration)
  recovery: false, // true after arriving from a password-reset email link
};
