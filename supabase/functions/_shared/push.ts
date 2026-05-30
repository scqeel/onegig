import webPush from "https://esm.sh/web-push@3.6.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VAPID_PUBLIC_KEY = "BIgGPa2q4_dFqkOYrjjeA7CsEGSTKKkg9vq11gOF-FN-B5R2z4g2rZXRuWP_Nls7z2yJ0E2j-cCSlH9iKyLtspE";
const VAPID_PRIVATE_KEY = "0G6RwpOmwQbimzJyW2rDevF0xNx4DlNSpvTbkqrsKRM";
const VAPID_SUBJECT = "mailto:onegig365@gmail.com";

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function sendWebPushNotification(admin: ReturnType<typeof createClient>, userId: string, payload: { title: string, message: string, url?: string }) {
  try {
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error || !subs || subs.length === 0) return;

    const payloadString = JSON.stringify(payload);

    const promises = subs.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      try {
        await webPush.sendNotification(pushSubscription, payloadString);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error("Error sending web push:", err);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
