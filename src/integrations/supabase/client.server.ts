// Supabase admin client removed - all requests use Express backend API & PostgreSQL
export const supabaseAdmin = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  }),
  auth: {
    admin: {
      createUser: () => Promise.resolve({ data: { user: null }, error: null }),
      deleteUser: () => Promise.resolve({ data: null, error: null }),
      updateUserById: () => Promise.resolve({ data: null, error: null }),
    },
  },
} as any;
