const crypto = require('node:crypto');

function requestFingerprint(req, secret) {
  const forwarded = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown');
  const ip = forwarded.split(',')[0].trim();
  const agent = String(req.headers['user-agent'] || 'unknown').slice(0, 240);
  return crypto.createHmac('sha256', secret).update(`${ip}|${agent}`).digest('hex');
}

async function enforceRateLimit({ req, supabaseUrl, serviceKey, scope, limit = 8, windowMinutes = 60 }) {
  const fingerprint = requestFingerprint(req, serviceKey);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const url = new URL(`${supabaseUrl}/rest/v1/submission_rate_limits`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('scope', `eq.${scope}`);
  url.searchParams.set('fingerprint', `eq.${fingerprint}`);
  url.searchParams.set('created_at', `gte.${since}`);

  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    console.error('lead_rate_limit_read_error', scope, response.status);
    return { allowed: true, degraded: true };
  }
  const attempts = await response.json();
  if (attempts.length >= limit) return { allowed: false, degraded: false };

  const writeResponse = await fetch(`${supabaseUrl}/rest/v1/submission_rate_limits`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ scope, fingerprint })
  });
  if (!writeResponse.ok) console.error('lead_rate_limit_write_error', scope, writeResponse.status);
  return { allowed: true, degraded: !writeResponse.ok };
}

module.exports = { enforceRateLimit, requestFingerprint };
