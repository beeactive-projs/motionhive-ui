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
    MEASUREMENTS: '/profile/measurements',
    GOALS: '/profile/goals',
    GOAL_BY_ID: (id: string) => `/profile/goals/${id}`,
  },
  CLIENTS: {
    BASE: '/clients',
    MY_INSTRUCTORS: '/clients/my-instructors',
    PENDING_REQUESTS: '/clients/requests/pending',
    INVITE: '/clients/invite',
    INVITE_BY_TOKEN: (token: string) => `/clients/invite/${token}`,
    ACCEPT_BY_TOKEN: '/clients/requests/accept-by-token',
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
  PAYMENTS: {
    // Instructor — onboarding
    ONBOARDING_START: '/payments/onboarding/start',
    ONBOARDING_STATUS: '/payments/onboarding/status',
    ONBOARDING_DASHBOARD_LINK: '/payments/onboarding/dashboard-link',

    // Instructor — products
    PRODUCTS: '/payments/products',
    PRODUCT_BY_ID: (id: string) => `/payments/products/${id}`,

    // Instructor — invoices
    INVOICES: '/payments/invoices',
    INVOICE_BY_ID: (id: string) => `/payments/invoices/${id}`,
    INVOICE_SEND: (id: string) => `/payments/invoices/${id}/send`,
    INVOICE_VOID: (id: string) => `/payments/invoices/${id}/void`,
    INVOICE_MARK_PAID: (id: string) => `/payments/invoices/${id}/mark-paid`,

    // Instructor — subscriptions
    SUBSCRIPTIONS: '/payments/subscriptions',
    SUBSCRIPTION_BY_ID: (id: string) => `/payments/subscriptions/${id}`,
    SUBSCRIPTION_CANCEL: (id: string) => `/payments/subscriptions/${id}/cancel`,

    // Instructor — refunds & earnings
    REFUNDS: '/payments/refunds',
    EARNINGS: '/payments/earnings',
    PAYMENTS_LIST: '/payments/payments',

    // Client — self-service
    CUSTOMER_SETUP_INTENT: '/payments/customers/setup-intent',
    CUSTOMER_PORTAL_LINK: '/payments/customers/portal-link',
    MY_INVOICES: '/payments/my/invoices',
    MY_INVOICE_BY_ID: (id: string) => `/payments/my/invoices/${id}`,
    MY_INVOICE_PAY: (id: string) => `/payments/my/invoices/${id}/pay`,
    MY_SUBSCRIPTIONS: '/payments/my/subscriptions',
    MY_PAYMENT_HISTORY: '/payments/my/payment-history',
  },
} as const;
