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
    RESEND_VERIFICATION: '/auth/resend-verification',
  },
  USERS: {
    BASE: '/users',
    ME: '/users/me',
    ME_AVATAR: '/users/me/avatar',
    SEARCH: '/users/search',
  },
  PROFILE: {
    BASE: '/profile',
    INSTRUCTORS: '/profile/instructors',
    DISCOVER_INSTRUCTORS: '/profile/instructors/discover',
  },
  VENUES: {
    BASE: '/venues',
    BY_ID: (id: string) => `/venues/${id}`,
    ARCHIVE: (id: string) => `/venues/${id}/archive`,
  },
  CLIENTS: {
    BASE: '/clients',
    MY_INSTRUCTORS: '/clients/my-instructors',
    LEAVE_INSTRUCTOR: (instructorId: string) =>
      `/clients/my-instructors/${instructorId}`,
    PENDING_REQUESTS: '/clients/requests/pending',
    INVITE: '/clients/invite',
    SENT_INVITES: '/clients/invites',
    INVITE_BY_TOKEN: (token: string) => `/clients/invite/${token}`,
    ACCEPT_BY_TOKEN: '/clients/requests/accept-by-token',
    REQUEST: '/clients/request',
    REQUESTS: '/clients/requests',
  },
  GROUPS: {
    BASE: '/groups',
    MEMBER_ROLE: (groupId: string, userId: string) =>
      `/groups/${groupId}/members/${userId}/role`,
  },
  POSTS: {
    BASE: '/posts',
    UPLOAD_IMAGE: '/posts/upload-image',
    GROUP_FEED: (groupId: string) => `/posts/group/${groupId}`,
    GROUP_PENDING: (groupId: string) => `/posts/group/${groupId}/pending`,
    BY_ID: (postId: string) => `/posts/${postId}`,
    AUDIENCE: (postId: string, groupId: string) =>
      `/posts/${postId}/audiences/${groupId}`,
    COMMENTS: (postId: string) => `/posts/${postId}/comments`,
    COMMENT: (postId: string, commentId: string) =>
      `/posts/${postId}/comments/${commentId}`,
    REACTIONS: (postId: string) => `/posts/${postId}/reactions`,
  },
  SESSIONS: {
    BASE: '/sessions',
  },
  BLOG: {
    BASE: '/blog',
    ADMIN_LIST: '/blog/admin',
    ADMIN_BY_ID: (id: string) => `/blog/admin/${id}`,
    BY_ID: (id: string) => `/blog/${id}`,
    UPLOAD_IMAGE: '/blog/upload-image',
  },
  FEEDBACK: {
    BASE: '/feedback',
  },
  WAITLIST: {
    BASE: '/waitlist',
  },
  INVITATIONS: {
    // Used by the home page invite dialogs. Endpoints don't exist on
    // the API yet — see InvitationService for the graceful-fallback
    // behaviour while we wait for the jobs/notifications module.
    FRIEND_EMAIL: '/invitations/friend',
    INSTRUCTOR_EMAIL: '/invitations/instructor',
  },
  PAYMENTS: {
    // Instructor — onboarding
    ONBOARDING_START: '/payments/onboarding/start',
    ONBOARDING_STATUS: '/payments/onboarding/status',
    ONBOARDING_REFRESH_STATUS: '/payments/onboarding/refresh-status',
    ONBOARDING_DASHBOARD_LINK: '/payments/onboarding/dashboard-link',

    // Instructor — products
    PRODUCTS: '/payments/products',
    PRODUCT_BY_ID: (id: string) => `/payments/products/${id}`,

    // Instructor — invoices
    INVOICES: '/payments/invoices',
    INVOICE_BY_ID: (id: string) => `/payments/invoices/${id}`,
    INVOICE_UPDATE: (id: string) => `/payments/invoices/${id}`,
    INVOICE_SEND: (id: string) => `/payments/invoices/${id}/send`,
    INVOICE_VOID: (id: string) => `/payments/invoices/${id}/void`,
    INVOICE_MARK_PAID: (id: string) => `/payments/invoices/${id}/mark-paid`,
    INVOICE_LINE_ITEMS: (id: string) => `/payments/invoices/${id}/line-items`,

    // Instructor — subscriptions
    SUBSCRIPTIONS: '/payments/subscriptions',
    SUBSCRIPTION_BY_ID: (id: string) => `/payments/subscriptions/${id}`,
    SUBSCRIPTION_SETUP_LINK: (id: string) => `/payments/subscriptions/${id}/setup-link`,
    SUBSCRIPTION_CANCEL: (id: string) => `/payments/subscriptions/${id}/cancel`,

    // Instructor — refunds & earnings
    REFUNDS: '/payments/refunds',
    EARNINGS: '/payments/earnings',
    PAYMENTS_LIST: '/payments/payments',

    // Client — self-service
    CUSTOMER_SETUP_INTENT: '/payments/my/setup-intent',
    CUSTOMER_PORTAL_LINK: '/payments/my/portal-link',
    MY_INVOICES: '/payments/my/invoices',
    MY_INVOICE_BY_ID: (id: string) => `/payments/my/invoices/${id}`,
    MY_INVOICE_PAY: (id: string) => `/payments/my/invoices/${id}/pay`,
    MY_INVOICE_LINE_ITEMS: (id: string) => `/payments/my/invoices/${id}/line-items`,
    MY_SUBSCRIPTIONS: '/payments/my/subscriptions',
    MY_SUBSCRIPTION_CANCEL: (id: string) => `/payments/my/subscriptions/${id}/cancel`,
    MY_COUNTS: '/payments/my/counts',

    // Public — no auth
    PUBLIC_INSTRUCTOR_PRODUCTS: (id: string) =>
      `/payments/public/instructors/${id}/products`,
  },
} as const;
