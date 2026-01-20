// ===== ENVIRONMENT DETECTION =====
const isProduction = import.meta.env.MODE === 'production';

// ===== DYNAMIC BASE URL =====
// Trong production: sử dụng origin hiện tại (localhost:80 hoặc domain)
// Trong development: sử dụng Vite dev server origin (localhost:5173)
const getBaseUrl = () => {
  return window.location.origin;
};

// ===== API BASE URL =====
// Production: relative path (nginx sẽ proxy /v1/* tới gateway)
// Development: empty string (Vite sẽ proxy /v1/* tới gateway)
export const API_BASE_URL = '';

// ===== LOCAL BASE URL (cho các API cần full URL) =====
export const LOCAL_BASE_URL = getBaseUrl();

// ===== WEBSOCKET URL =====
export const NOTIFICATION_WS_URL = getBaseUrl();

// ===== OAUTH REDIRECT URI =====
const getGoogleRedirectUri = () => {
  if (isProduction) {
    // Production: use origin from env or window.location
    return import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${getBaseUrl()}/oauth2/callback`;
  }
  // Development: sử dụng 5173 port
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${getBaseUrl()}/oauth2/callback`;
};

export const GOOGLE_REDIRECT_URI = getGoogleRedirectUri();
export const GOOGLE_CLIENT_ID = '941069814660-or8vut20mcc30h2lp3lgdrfqd48j4qkc.apps.googleusercontent.com';

export const FACEBOOK_CLIENT_ID = '1404318728067713';
export const FACEBOOK_REDIRECT_URI = GOOGLE_REDIRECT_URI;
