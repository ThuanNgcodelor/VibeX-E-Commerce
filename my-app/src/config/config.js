// API Configuration
const getApiBaseUrl = () => {
  // Trong production build, sử dụng relative path hoặc env variable
  if (import.meta.env.MODE === 'production') {
    // Sử dụng relative path để Nginx proxy đúng
    return '/api'
  }
  // Development mode
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

const getGoogleRedirectUri = () => {
  if (import.meta.env.MODE === 'production') {
    return import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin + '/oauth2/callback'
  }
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/oauth2/callback'
}

export const API_BASE_URL = getApiBaseUrl()
export const LOCAL_BASE_URL = 'http://localhost:8080'
// WebSocket URL for notification-service (runs on port 8084, not through gateway)
export const NOTIFICATION_WS_URL = import.meta.env.VITE_NOTIFICATION_WS_URL || 'http://localhost:8080'
export const GOOGLE_REDIRECT_URI = getGoogleRedirectUri()
export const GOOGLE_CLIENT_ID = '941069814660-or8vut20mcc30h2lp3lgdrfqd48j4qkc.apps.googleusercontent.com'

export const FACEBOOK_CLIENT_ID = '1394221255578112'
export const FACEBOOK_REDIRECT_URI = GOOGLE_REDIRECT_URI // Reuse callback URI logic for now
