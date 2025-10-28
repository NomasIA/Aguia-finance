import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwzzaqcysxvlrlgyqucp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3enphcWN5c3h2bHJsZ3lxdWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTExNjksImV4cCI6MjA3NjcyNzE2OX0.NgSIKyrHeKjXQnrHMQ6R3juC__4SWEVODOkkQskzXzo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
});
