export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = null; }
  if (!body) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'bad json' }) };

  const { kind, message, honeypot, seed, cfgName, startEra, opponents, year, buildStamp } = body;

  if (honeypot) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  if (typeof message !== 'string' || !message.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'message required' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.REPORT_REPO || 'hf7y/american-cycle';
  if (!token) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'reporting is not configured' }) };
  }

  const isBug = kind === 'bug';
  const text = message.trim();
  const title = `${isBug ? 'Bug' : 'Idea'} report: ${text.slice(0, 72)}`;
  const repro = JSON.stringify({ seed, cfgName, startEra, opponents, year, buildStamp }, null, 2);
  const issueBody = [
    text,
    '',
    '---',
    'Filed from the hosted board.',
    '',
    '**Reproduce:**',
    '```json',
    repro,
    '```',
  ].join('\n');

  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'american-cycle-report-form',
      },
      body: JSON.stringify({ title, body: issueBody, labels: ['playtest', isBug ? 'bug' : 'enhancement'] }),
    });
  } catch {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'could not reach github' }) };
  }

  if (!res.ok) {
    const detail = await res.text();
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: detail.slice(0, 300) }) };
  }

  const issue = await res.json();
  return { statusCode: 200, body: JSON.stringify({ ok: true, url: issue.html_url }) };
};
