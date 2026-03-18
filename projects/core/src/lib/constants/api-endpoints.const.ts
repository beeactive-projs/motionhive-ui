export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    GOOGLE: '/auth/google',
    FACEBOOK: '/auth/facebook',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    BASE: '/users',
    ME: '/users/me',
  },
  PROFILE: {
    BASE: '/profile',
    INSTRUCTORS: '/profile/instructors',
    DISCOVER_INSTRUCTORS: '/profile/instructors/discover',
  },
  CLIENTS: {
    BASE: '/clients',
    MY_INSTRUCTORS: '/clients/my-instructors',
    PENDING_REQUESTS: '/clients/requests/pending',
    INVITE: '/clients/invite',
    REQUEST: '/clients/request',
    REQUESTS: '/clients/requests',
  },
  GROUPS: {
    BASE: '/groups',
  },
  SESSIONS: {
    BASE: '/sessions',
  },
  BLOG: {
    BASE: '/blog',
    UPLOAD_IMAGE: '/blog/upload-image',
  },
  FEEDBACK: {
    BASE: '/feedback',
  },
  WAITLIST: {
    BASE: '/waitlist',
  },
} as const;
