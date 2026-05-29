import { createClient } from '@supabase/supabase-js';

const url = 'https://huvuogyvgeoqiqltbgcw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('orders').select('id, status, notes').eq('status', 'failed').order('created_at', { ascending: false }).limit(5);
  console.log('Error:', error);
  console.log('Data:', data);
}

run();
