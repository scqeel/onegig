const fs = require('fs');
const https = require('https');

function run() {
  if (!fs.existsSync('deploy_output.txt')) {
    console.error('deploy_output.txt does not exist');
    return;
  }
  const logs = fs.readFileSync('deploy_output.txt', 'utf8');
  // Escape single quotes for SQL insertion
  const escapedLogs = logs.replace(/'/g, "''");
  const sql = `INSERT INTO public.orders (reference, recipient_phone, sell_price, status, notes) VALUES ('deploy-log', '0000000000', 0, 'failed', '${escapedLogs}')`;
  
  const data = JSON.stringify({ exec_sql: sql });
  
  const req = https.request({
    hostname: 'huvuogyvgeoqiqltbgcw.supabase.co',
    path: '/functions/v1/debug-db',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('RESPONSE:', body);
    });
  });
  
  req.on('error', (e) => {
    console.error('Failed to log to DB:', e);
  });
  
  req.write(data);
  req.end();
}

run();
