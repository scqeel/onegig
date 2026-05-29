import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const NOTIFICATION_SOUNDS: Record<string, string> = {
  default: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
  success: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
  paystack: "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3", // Coin Drop
  alert: "https://assets.mixkit.co/active_storage/sfx/940/940-preview.mp3",
};

export function InAppNotificationListener() {
  const { session } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio with default sound
    audioRef.current = new Audio(NOTIFICATION_SOUNDS.default);
    audioRef.current.volume = 0.8; 

    // Browsers block audio playback unless the user has interacted with the page.
    // We attach a one-time click listener to "unlock" the audio context.
    const unlockAudio = () => {
      if (audioRef.current) {
        // Try playing and immediately pausing to unlock it
        audioRef.current.play().then(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }).catch(() => {
          // Ignore the error if it fails
        });
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
        },
        (payload) => {
          const notif = payload.new;
          
          // Check if this notification is for us
          if (notif.is_global || notif.target_user_id === session?.user?.id) {
            
            // Play sound dynamically
            if (audioRef.current) {
              const soundUrl = NOTIFICATION_SOUNDS[notif.sound_name || "default"] || NOTIFICATION_SOUNDS.default;
              if (audioRef.current.src !== soundUrl) {
                audioRef.current.src = soundUrl;
                audioRef.current.load();
              }
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(e => {
                console.warn("Audio play prevented by browser:", e);
              });
            }

            // Show Toast
            toast({
              title: notif.title,
              description: notif.message,
              variant: notif.type === 'error' ? 'destructive' : 'default',
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, [session?.user?.id, toast]);

  return null;
}
