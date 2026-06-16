import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = 'https://huvuogyvgeoqiqltbgcw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ';

const supabase = createClient(url, key);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.app_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        is_global BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

    -- Allow anyone to read global notifications or notifications meant for them
    CREATE POLICY "Users can read their own or global notifications"
        ON public.app_notifications FOR SELECT
        TO authenticated, anon
        USING (is_global = true OR target_user_id = auth.uid());

    -- Only admins can insert/update/delete notifications
    CREATE POLICY "Admins can manage notifications"
        ON public.app_notifications FOR ALL
        TO authenticated
        USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    -- Enable Realtime for app_notifications
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'app_notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
        END IF;
    END
    $$;
  `;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || url;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || key;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/debug-db?exec_sql=${encodeURIComponent(sql)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey
      }
    });
    const data = await res.json();
    if (data.ok) {
      console.log("Success:", data.result);
    } else {
      console.error("Failed executing SQL via edge:", data.error);
    }
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

run();
