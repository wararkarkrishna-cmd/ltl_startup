import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byjhclavuwlomujwuoku.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5amhjbGF2dXdsb211and1b2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDk0ODgsImV4cCI6MjEwMzcyNTQ4OH0.KoLaeDg6FV_xhyqKTzGU1jeEJEMXxaRlD6gx-d8wUgo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
