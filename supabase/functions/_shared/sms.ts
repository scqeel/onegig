export async function sendSMS({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  const apiKey = Deno.env.get("TXTCONNECT_API_KEY");
  if (!apiKey) {
    console.error("Missing TXTCONNECT_API_KEY");
    return;
  }

  // Format phone number. Remove leading + or 0, prefix with country code if needed.
  // Assuming Ghana for OneGig (+233)
  let formattedTo = to.replace(/[^0-9]/g, "");
  if (formattedTo.startsWith("0")) {
    formattedTo = "233" + formattedTo.slice(1);
  } else if (!formattedTo.startsWith("233")) {
    formattedTo = "233" + formattedTo;
  }

  try {
    const res = await fetch("https://api.txtconnect.net/dev/api/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: formattedTo,
        from: "OneGig",
        unicode: "0",
        sms: message,
      }),
      signal: AbortSignal.timeout(3000)
    });

    const data = await res.json().catch(() => null);
    
    if (!res.ok || data?.data?.in_error) {
      console.error("SMS Sending Failed:", data);
    } else {
      console.log("SMS Sent Successfully:", data);
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
}
