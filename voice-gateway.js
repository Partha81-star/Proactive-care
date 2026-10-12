// Expose only the call webhook, never the staff dashboard or patient APIs.
import http from 'node:http';
const token = process.env.VOICE_GATEWAY_TOKEN;
if (!token || token.length < 32) throw new Error('Set a random VOICE_GATEWAY_TOKEN of at least 32 characters.');
const target = `http://127.0.0.1:${Number(process.env.PORT || 3000)}`;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const prefix = `/voice/${token}`;
  const route = url.pathname.slice(prefix.length);
  if (req.method !== 'POST' || !url.pathname.startsWith(prefix + '/') || !['/api/twilio/voice', '/api/twilio/voice/status'].includes(route)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16384) { res.writeHead(413); res.end(); return; }
    }
    const fields = new URLSearchParams(raw);
    if (!/^CA[a-f0-9]{32}$/i.test(fields.get('CallSid') || '')) { res.writeHead(400); res.end(); return; }
    const upstream = await fetch(target + route + url.search, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: raw, signal: AbortSignal.timeout(12000),
    });
    const text = (await upstream.text()).replaceAll('action="/api/twilio/', `action="${prefix}/api/twilio/`);
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'text/xml', 'Cache-Control': 'no-store' });
    res.end(text);
  } catch {
    res.writeHead(503, { 'Content-Type': 'text/xml' });
    res.end('<Response><Say>Our appointment system is temporarily unavailable. Please try again later.</Say><Hangup/></Response>');
  }
}).listen(Number(process.env.VOICE_GATEWAY_PORT || 3001), '127.0.0.1', () => console.log('Voice-only gateway ready on localhost:3001'));
