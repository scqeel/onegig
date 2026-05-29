import { createClient } from '@supabase/supabase-js';

const url = 'https://huvuogyvgeoqiqltbgcw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ';

const supabase = createClient(url, key);

async function run() {
  const { data: bundles, error } = await supabase.from('bundles').select('id, size_label, size_mb, provider_plan_id').limit(10);
  console.log('Error:', error);
  console.log('Bundles:', bundles);
}

run();
