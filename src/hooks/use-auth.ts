// Custom hook for authentication state
// TODO: Implement after Supabase setup

export function useAuth() {
  // Will provide:
  // - user: current authenticated user
  // - profile: user profile from our users table
  // - loading: auth state loading
  // - signIn: email/password sign in
  // - signUp: email/password sign up
  // - signOut: sign out

  return {
    user: null,
    profile: null,
    loading: true,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
  };
}
