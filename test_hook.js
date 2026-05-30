const body = {
  phone: "+233555123456",
  token: "123456"
};

fetch("https://huvuogyvgeoqiqltbgcw.supabase.co/functions/v1/auth-sms-webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
})
.then(res => res.text().then(text => ({ status: res.status, text })))
.then(console.log)
.catch(console.error);
