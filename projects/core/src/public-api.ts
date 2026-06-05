/*
 * Public API Surface of core
 */

// Models - Auth
export * from './lib/models/auth/login.model';
export * from './lib/models/auth/register.model';
export * from './lib/models/auth/auth-response.model';
export * from './lib/models/auth/password-reset.model';
export * from './lib/models/auth/social-login.model';

// Models - User — exports User, AvatarUser, UserInfo, UserSearchResult, …
export * from './lib/models/user/user.model';
export * from './lib/models/user/role.enums';
export * from './lib/models/user/role.model';

// Models - Profile
export * from './lib/models/profile/profile.enums';
export * from './lib/models/profile/instructor-profile.model';
export * from './lib/models/profile/profile.model';
export * from './lib/models/profile/instructor-group-summary.model';
export * from './lib/models/profile/public-user-profile.model';
export * from './lib/models/profile/public-profile-view.model';
export * from './lib/models/profile/profile-stat.model';
export * from './lib/models/profile/profile-badge.model';
export * from './lib/models/profile/instructor-lead.model';

// Models - Review
export * from './lib/models/review/review.model';

// Models - Venue
export * from './lib/models/venue/venue.enums';
export * from './lib/models/venue/venue.model';

// Models - Exercise
export * from './lib/models/exercise/exercise.enums';
export * from './lib/models/exercise/exercise.model';
export * from './lib/models/exercise/muscle.model';
export * from './lib/models/exercise/equipment.model';

// Models - Workout (program / assignment / log)
export * from './lib/models/workout/workout.enums';
export * from './lib/models/workout/program.model';
export * from './lib/models/workout/assignment.model';
export * from './lib/models/workout/log.model';

// Models - Client
export * from './lib/models/client/client.enums';
export * from './lib/models/client/client.model';
export * from './lib/models/client/instructor.model';

// Models - Group
export * from './lib/models/group/group.enums';
export * from './lib/models/group/group.model';

// Models - Post
export * from './lib/models/post/post.model';

// Models - Common
export * from './lib/models/common/api-response.model';
export * from './lib/models/common/pagination.model';
export * from './lib/models/common/ui.enums';
export * from './lib/models/common/nav.model';

// Models - Blog
export * from './lib/models/blog/blog.enums';
export * from './lib/models/blog/blog.model';

// Models - Feedback
export * from './lib/models/feedback/feedback.enums';
export * from './lib/models/feedback/feedback.model';

// Models - Search
export * from './lib/models/search/search.model';

// Models - Waitlist
export * from './lib/models/waitlist/waitlist.enums';
export * from './lib/models/waitlist/waitlist.model';

// Models - Payment
export * from './lib/models/payment/payment.enums';
export * from './lib/models/payment/stripe-account.model';
export * from './lib/models/payment/product.model';
export * from './lib/models/payment/invoice.model';
export * from './lib/models/payment/subscription.model';
export * from './lib/models/payment/payment.model';
export * from './lib/models/payment/earnings.model';
export * from './lib/models/payment/status-severity';

// Models - Notification
export * from './lib/models/notification';

// Models - Messaging
export * from './lib/models/messaging';

// Models - Session
// NOTE: profile.enums.ts already exports a `SessionType` referring to the
// instructor-profile "session kinds" concept (ONLINE/IN_PERSON/HYBRID).
// To avoid a collision with the new session module's `SessionType`
// (GROUP/PRIVATE/OPEN), the session module enums are re-exported via
// a namespaced barrel until we can clean up the profile model.
export {
  CancelScope,
  FollowUpAudience,
  MyTab,
  SessionAccess,
  SessionInstanceStatus,
  SessionLocationKind,
  SessionMeetingProvider,
  SessionParticipantStatus,
  SessionReminderKind,
  SessionTemplateStatus,
  SessionType as SessionKind,
  TemplateTab,
} from './lib/models/session/session.enums';
export type {
  // Refs
  SessionInstructorRef,
  SessionVenueRef,
  SessionGroupRef,
  // Core domain
  RecurrenceRule,
  SessionTemplate,
  SessionInstance,
  SessionParticipant,
  // Public + blocked variants
  PublicSessionInstance,
  BlockedSessionInstance,
  // Service request / response shapes
  CreateTemplateRequest,
  UpdateTemplateRequest,
  PreviewRecurrenceRequest,
  PreviewRecurrenceResponse,
  RegenerateRequest,
  RegenerateResponse,
  CreateTemplateResponse,
  SessionWarning,
  ListTemplatesQuery,
  ListInstancesQuery,
  ListParticipantsQuery,
  DiscoverQuery,
  MyQuery,
  BookRequest,
  BookResponse,
  CancelBookingRequest,
  CancelBookingResponse,
  CancelInstanceRequest,
  CancelInstanceResponse,
  RescheduleInstanceRequest,
  RescheduleInstanceResponse,
  PatchInstanceRequest,
  DeclineParticipantRequest,
  PatchParticipantRequest,
  FollowUpRequest,
  FollowUpResponse,
  MyCounts,
  JoinInfo,
} from './lib/models/session/session.model';
export { isBlockedInstance } from './lib/models/session/session.model';

// Constants
export * from './lib/constants/api-endpoints.const';
export * from './lib/constants/storage-keys.const';
export * from './lib/constants/timezones.const';
export * from './lib/constants/date-windows.const';
export * from './lib/constants/countries.const';

// Utils
export * from './lib/utils/url.utils';
export * from './lib/utils/api-error.utils';
export * from './lib/utils/cloudinary.utils';
export * from './lib/utils/group.utils';
export * from './lib/utils/date.utils';
export * from './lib/utils/youtube.utils';
export * from './lib/utils/html.utils';
export * from './lib/utils/viewport.utils';
export * from './lib/utils/session-format.utils';

// Services
export * from './lib/services/auth/auth.service';
export * from './lib/services/auth/token.service';
export * from './lib/services/auth/google-auth.service';
export * from './lib/services/auth/facebook-auth.service';
export * from './lib/services/user/user.service';
export * from './lib/services/profile/profile.service';
export * from './lib/services/client/client.service';
export * from './lib/services/group/group.service';
export * from './lib/services/group/groups-refresh.service';
export * from './lib/services/post/post.service';
export * from './lib/services/blog/blog.service';
export * from './lib/services/feedback/feedback.service';
export * from './lib/services/invitation/invitation.service';
export * from './lib/services/search/search.service';
export * from './lib/services/waitlist/waitlist.service';
export * from './lib/services/error-dialog/error-dialog.service';
export * from './lib/services/theme/theme.service';
export * from './lib/services/payment/stripe-onboarding.service';
export * from './lib/services/payment/product.service';
export * from './lib/services/payment/invoice.service';
export * from './lib/services/payment/subscription.service';
export * from './lib/services/payment/refund.service';
export * from './lib/services/payment/earnings.service';
export * from './lib/services/payment/client-payment.service';
export * from './lib/services/venue/venue.service';
export * from './lib/services/exercise/exercise.service';
export * from './lib/services/workout/program.service';
export * from './lib/services/workout/program-assignment.service';
export * from './lib/services/workout/workout-log.service';
export * from './lib/services/notification/notification.service';
export * from './lib/services/messaging';
export * from './lib/services/session/session.service';

// Pipes
export * from './lib/pipes/currency-ron.pipe';
export * from './lib/pipes/status-label.pipe';

// Directives
export * from './lib/directives/stripe-iframe.directive';

// Stores
export * from './lib/stores/auth.store';
export * from './lib/stores/exercise-taxonomy.store';
export * from './lib/stores/recent-searches.store';
export * from './lib/stores/stripe-onboarding.store';
export * from './lib/stores/notification.store';
export * from './lib/stores/public-profile.store';
export * from './lib/stores/messaging.store';

// Interceptors
export * from './lib/interceptors/auth.interceptor';
export * from './lib/interceptors/error.interceptor';
export * from './lib/interceptors/loading.interceptor';
export * from './lib/interceptors/silent-request.context';

// Loading
export * from './lib/services/loading/loading.service';

// Components
export * from './lib/components/logo/logo';
export * from './lib/components/page-shell/page-shell';
export * from './lib/components/dialog-shell/dialog-shell';
// Mobile-first primitives — sheet/time-row/day-sep/sticky-cta/fab.
export * from './lib/components/bottom-sheet/bottom-sheet';
export * from './lib/components/time-row/time-row';
export * from './lib/components/day-separator/day-separator';
export * from './lib/components/sticky-cta/sticky-cta';
export * from './lib/components/mobile-fab/mobile-fab';
export * from './lib/components/action-list/action-list';
export * from './lib/components/week-strip/week-strip';
export * from './lib/components/time-row-skeleton/time-row-skeleton';
export * from './lib/components/section-label/section-label';
export * from './lib/components/tri-state-toggle/tri-state-toggle';
export * from './lib/components/calendar/calendar-event.model';
export * from './lib/components/calendar/calendar-grid';
export * from './lib/components/calendar/event-block';
// Phase B — session-flavored chips, capacity bar, avatar stack, session card.
export * from './lib/components/access-chip/access-chip';
export * from './lib/components/type-chip/type-chip';
export * from './lib/components/provider-chip/provider-chip';
export * from './lib/components/capacity-bar/capacity-bar';
export * from './lib/components/avatar-stack/avatar-stack';
export * from './lib/components/session-card/session-card';

// Phase C — date-picker primitive (calendar left rail navigation).
export * from './lib/components/mini-month/mini-month';

// Phase D — dialog primitives.
export * from './lib/components/recurrence-builder/recurrence-builder';
export * from './lib/components/participants-table/participants-table';

// Stores — Sessions
export * from './lib/stores/sessions-instructor.store';
export * from './lib/stores/sessions-detail.store';
export * from './lib/stores/sessions-discover.store';
export * from './lib/stores/sessions-my.store';
export * from './lib/stores/my-bookings-index.store';

// Guards
export * from './lib/guards/auth.guard';
export * from './lib/guards/role.guard';

// Environment
export * from './environments/environment';
