const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '592948920401-d5lrh1j5q76g6huld6h1nmuvp21p90v.apps.googleusercontent.com';

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    const error = new Error('Google authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
  );

  if (!response.ok) {
    const error = new Error('Google session is invalid or expired.');
    error.statusCode = 401;
    throw error;
  }

  const payload = await response.json();

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    const error = new Error('Google client ID does not match the server configuration.');
    error.statusCode = 401;
    throw error;
  }

  if (payload.email_verified !== 'true') {
    const error = new Error('Google email is not verified.');
    error.statusCode = 403;
    throw error;
  }

  return {
    email: String(payload.email || '').toLowerCase(),
    name: payload.name || payload.email || 'User',
    sub: payload.sub
  };
}

function sendAuthError(res, error) {
  res.status(error.statusCode || 500).json({
    message: error.message || 'Authentication failed.'
  });
}

module.exports = { authenticate, sendAuthError, GOOGLE_CLIENT_ID };