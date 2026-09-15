const API_ROOT = 'https://api.github.com';
const REPO = process.env.GITHUB_REPO || 'AshwantDevops/irrigation-dashboard-bareilly';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

function headers() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured in Vercel.');
  }
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function getJsonFile(path) {
  const response = await fetch(
    `${API_ROOT}/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`,
    { headers: headers() }
  );

  if (response.status === 404) return { data: null, sha: null };

  if (!response.ok) {
    throw new Error(`GitHub read failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const text = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');

  return {
    data: JSON.parse(text),
    sha: payload.sha
  };
}

async function putJsonFile(path, data, sha, message) {
  const response = await fetch(
    `${API_ROOT}/repos/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        message,
        content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'),
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub write failed: HTTP ${response.status} ${body}`);
  }

  return response.json();
}

module.exports = { getJsonFile, putJsonFile, REPO, BRANCH };