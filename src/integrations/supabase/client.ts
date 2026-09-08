// Supabase client removed - all requests use Express backend API & PostgreSQL
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    updateUser: async () => ({ error: null }),
  },
} as any;
