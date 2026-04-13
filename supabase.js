const SUPABASE_URL     = 'https://idhvfxbkfljtwjfvpulu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHZmeGJrZmxqdHdqZnZwdWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjU0NjAsImV4cCI6MjA5MTY0MTQ2MH0._SEWNgZPwGKfBwHiGbT2kG8Uq4Jcbq-1uTS8DJC1IAI';

// the cdn script (loaded in index.html) exposes a global `supabase` object
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);