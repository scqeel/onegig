export const VAPID_PUBLIC_KEY = "BIgGPa2q4_dFqkOYrjjeA7CsEGSTKKkg9vq11gOF-FN-B5R2z4g2rZXRuWP_Nls7z2yJ0E2j-cCSlH9iKyLtspE";

export async function subscribeToPushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn("Push notifications are not supported by the browser.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - VAPID_PUBLIC_KEY.length % 4) % 4);
      const base64 = (VAPID_PUBLIC_KEY + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });
    }

    // Save subscription to our database
    const subJson = subscription.toJSON();
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth
    }, { onConflict: 'endpoint' });

    if (error) {
      console.error("Failed to save push subscription:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    return false;
  }
}
