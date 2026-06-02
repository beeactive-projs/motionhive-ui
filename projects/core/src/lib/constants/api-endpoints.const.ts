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
    VERIFY_EMAIL: '/auth/verify-email',
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
    INSTRUCTOR_BY_HANDLE: (handle: string) => `/profile/instructors/by-handle/${handle}`,
    INSTRUCTOR_GROUPS: (id: string) => `/profile/instructors/${id}/groups`,
    INSTRUCTOR_REVIEWS: (id: string) => `/profile/instructors/${id}/reviews`,
    USER_BY_HANDLE: (handle: string) => `/profile/users/by-handle/${handle}`,
    PRIVACY: '/profile/privacy',
    HANDLE: '/profile/handle',
    // Public lead-capture endpoint — POSTed from the "Reach out to <Name>"
    // dialog on the instructor profile. No auth required (the design's
    // one always-public action). Backend lands in Phase A2.
    INSTRUCTOR_LEADS: '/profile/instructor-leads',
  },
  VENUES: {
    BASE: '/venues',
    BY_ID: (id: string) => `/venues/${id}`,
    ARCHIVE: (id: string) => `/venues/${id}/archive`,
  },
  CLIENTS: {
    BASE: '/clients',
    MY_INSTRUCTORS: '/clients/my-instructors',
    LEAVE_INSTRUCTOR: (instructorId: string) => `/clients/my-instructors/${instructorId}`,
    PENDING_REQUESTS: '/clients/requests/pending',
    PENDING_REQUESTS_COUNT: '/clients/requests/pending/count',
    FILTER_REQUESTS: '/clients/requests/filter',
    INVITE: '/clients/invite',
    SENT_INVITES: '/clients/invites',
    INVITE_BY_TOKEN: (token: string) => `/clients/invite/${token}`,
    ACCEPT_BY_TOKEN: '/clients/requests/accept-by-token',
    REQUEST: '/clients/request',
    REQUESTS: '/clients/requests',
  },
  GROUPS: {
    BASE: '/groups',
    DISCOVER: '/groups/discover',
    BULK_MEMBERS: (groupId: string) => `/groups/${groupId}/members/bulk`,
    MEMBER_ROLE: (groupId: string, userId: string) => `/groups/${groupId}/members/${userId}/role`,
    JOIN_REQUESTS: (groupId: string) => `/groups/${groupId}/join-requests`,
    JOIN_REQUEST_BY_ID: (groupId: string, requestId: string) =>
      `/groups/${groupId}/join-requests/${requestId}`,
    MY_JOIN_REQUEST: (groupId: string) => `/groups/${groupId}/join-requests/mine`,
    PUBLIC_PROFILE: (groupId: string) => `/groups/${groupId}/public`,
  },
  POSTS: {
    BASE: '/posts',
    FEED: '/posts/feed',
    UPLOAD_IMAGE: '/posts/upload-image',
    GROUP_FEED: (groupId: string) => `/posts/group/${groupId}`,
    GROUP_PENDING: (groupId: string) => `/posts/group/${groupId}/pending`,
    BY_ID: (postId: string) => `/posts/${postId}`,
    MODERATE: (postId: string) => `/posts/${postId}/moderate`,
    COMMENTS: (postId: string) => `/posts/${postId}/comments`,
    COMMENT: (postId: string, commentId: string) => `/posts/${postId}/comments/${commentId}`,
    REACTIONS: (postId: string) => `/posts/${postId}/reactions`,
  },
  // Sessions module — see SESSIONS_FRONTEND_BUILD_PLAN.md §A.2.
  // Mirrors every endpoint of the live BE (24 surfaces).
  SESSIONS: {
    BASE: '/sessions',
    // Templates (instructor)
    TEMPLATES: '/sessions/templates',
    TEMPLATE_BY_ID: (id: string) => `/sessions/templates/${id}`,
    PREVIEW_RECURRENCE: '/sessions/templates/preview-recurrence',
    REGENERATE: (id: string) => `/sessions/templates/${id}/regenerate`,
    // Instances (read + write)
    INSTANCES: '/sessions/instances',
    INSTANCE_BY_ID: (id: string) => `/sessions/instances/${id}`,
    INSTANCE_PARTICIPANTS: (id: string) => `/sessions/instances/${id}/participants`,
    CANCEL_INSTANCE: (id: string) => `/sessions/instances/${id}/cancel`,
    RESCHEDULE_INSTANCE: (id: string) => `/sessions/instances/${id}/reschedule`,
    FOLLOW_UP: (id: string) => `/sessions/instances/${id}/follow-up`,
    // Booking (client)
    BOOK: (id: string) => `/sessions/instances/${id}/book`,
    CANCEL_BOOKING: (id: string) => `/sessions/instances/${id}/cancel-booking`,
    // Instructor → participant
    APPROVE_PARTICIPANT: (instanceId: string, participantId: string) =>
      `/sessions/instances/${instanceId}/participants/${participantId}/approve`,
    DECLINE_PARTICIPANT: (instanceId: string, participantId: string) =>
      `/sessions/instances/${instanceId}/participants/${participantId}/decline`,
    PARTICIPANT_BY_ID: (instanceId: string, participantId: string) =>
      `/sessions/instances/${instanceId}/participants/${participantId}`,
    // Public surface
    DISCOVER: '/sessions/discover',
    PUBLIC_BY_SLUG: (handle: string, slug: string) =>
      `/sessions/public/${handle}/${slug}`,
    PUBLIC_INSTANCE: (id: string) => `/sessions/instances/${id}/public`,
    // Client utilities
    MY: '/sessions/my',
    MY_COUNTS: '/sessions/my/counts',
    ICS: (id: string) => `/sessions/instances/${id}/ics`,
    JOIN_INFO: (id: string) => `/sessions/instances/${id}/join-info`,
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
    PUBLIC_INSTRUCTOR_PRODUCTS: (id: string) => `/payments/public/instructors/${id}/products`,
  },
  NOTIFICATIONS: {
    // Bell list + interactions
    BASE: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    READ_ALL: '/notifications/read-all',
    VIEWED: '/notifications/viewed',
    READ: (receiptId: string) => `/notifications/${receiptId}/read`,
    CLICKED: (receiptId: string) => `/notifications/${receiptId}/clicked`,
    DISMISS: (receiptId: string) => `/notifications/${receiptId}/dismiss`,
    BY_ID: (receiptId: string) => `/notifications/${receiptId}`,
  },
  NOTIFICATION_SETTINGS: {
    // Per-user preference overrides — grouped by NotificationCategory
    // (~6 categories). Per-type granularity exists under the hood but
    // isn't exposed on the API.
    BASE: '/users/me/notification-settings',
    RESET_CATEGORY: (category: string) =>
      `/users/me/notification-settings/${category}/reset`,
  },
  DEVICES: {
    // Web push + mobile FCM token registration
    REGISTER: '/devices/register',
    LIST: '/devices',
    BY_ID: (deviceId: string) => `/devices/${deviceId}`,
    HEARTBEAT: (deviceId: string) => `/devices/${deviceId}/seen`,
  },
  EXERCISES: {
    BASE: '/exercises',
    BY_ID: (id: string) => `/exercises/${id}`,
    FORK: (id: string) => `/exercises/${id}/fork`,
  },
  MUSCLES: {
    BASE: '/muscles',
  },
  EQUIPMENT: {
    BASE: '/equipment',
  },
  MESSAGING: {
    CONVERSATIONS: '/messaging/conversations',
    CONVERSATION: (id: string) => `/messaging/conversations/${id}`,
    CONVERSATION_MESSAGES: (id: string) =>
      `/messaging/conversations/${id}/messages`,
    CONVERSATION_READ: (id: string) => `/messaging/conversations/${id}/read`,
    CONVERSATION_MUTE: (id: string) => `/messaging/conversations/${id}/mute`,
    CONVERSATION_LEAVE: (id: string) => `/messaging/conversations/${id}/leave`,
    MESSAGES: '/messaging/messages',
    MESSAGE: (id: string) => `/messaging/messages/${id}`,
    BLOCKS: '/messaging/blocks',
    BLOCK: (blockedId: string) => `/messaging/blocks/${blockedId}`,
    REPORTS: '/messaging/reports',
    UNREAD_COUNT: '/messaging/unread-count',
    STREAM: '/messaging/stream',
    STREAM_ACK: '/messaging/stream/ack',
  },
} as const;
