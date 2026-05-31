import { createClient } from '@supabase/supabase-js';

const url = 'https://huvuogyvgeoqiqltbgcw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ';

const supabase = createClient(url, key);

async function run() {
  const sql = `
    ALTER TABLE public.agent_profiles 
    ADD COLUMN IF NOT EXISTS enable_ai_assistant BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS enable_loyalty_rewards BOOLEAN DEFAULT true;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
     console.error("Error:", error.message);
  } else {
     console.log("Success:", data);
  }
}

run();
