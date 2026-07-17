/**
 * Single source of truth for the product features surfaced on the marketing
 * site. Drives the nav Features mega-menu, the homepage feature grid, the
 * /features overview, and the 7 /features/:slug pages (one template). Add or
 * edit a feature here, not in page markup.
 *
 * `tone` maps to `mh-hex` / `mh-kicker` tones. `icon` is a projected emoji
 * glyph. `preview` is the muted-video source for the mega-menu / feature-hero
 * demo — null for now (a poster placeholder renders until the asset exists);
 * dropping a file path here lights it up with no code change.
 *
 * Copy rules (docs/content/content-playbook.md): no dashes as punctuation,
 * no AI tells, concrete over clever. RO strings come from the i18n catalogue.
 */
export type FeatureTone = 'amber' | 'teal';

export interface FeatureBenefit {
  icon: string;
  title: string;
  body: string;
}

export interface FeatureFaq {
  q: string;
  a: string;
}

export interface MarketingFeature {
  slug: string;
  name: string;
  icon: string;
  tone: FeatureTone;
  /** One-line description for the mega-menu row + overview card. */
  oneLiner: string;
  /** Muted autoplay preview clip (poster fallback until provided). */
  preview: string | null;
  poster: string | null;

  // ── detail page ──
  /** H1 split so the payoff half renders in amber. */
  h1Lead: string;
  h1Accent: string;
  intro: string;
  capabilities: string[];
  benefits: FeatureBenefit[];
  faq: FeatureFaq[];
  /** Slugs of the 3 features cross-linked at the bottom. */
  related: string[];
  metaTitle: string;
  metaDescription: string;
}

export const FEATURES: MarketingFeature[] = [
  {
    slug: 'storefront',
    name: $localize`:@@feat.storefront.name:Storefront`,
    icon: '🏪',
    tone: 'amber',
    oneLiner: $localize`:@@feat.storefront.one:Your public, bookable coaching page`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.storefront.h1a:A coaching page people`,
    h1Accent: $localize`:@@feat.storefront.h1b:actually book.`,
    intro: $localize`:@@feat.storefront.intro:Your storefront is the page you send people to. It shows who you are, what you run, and lets someone book without a single back and forth message.`,
    capabilities: [
      $localize`:@@feat.storefront.c1:A public page at your own handle`,
      $localize`:@@feat.storefront.c2:Show your sessions, programs and prices`,
      $localize`:@@feat.storefront.c3:Let people book without messaging you first`,
      $localize`:@@feat.storefront.c4:One link for your bio, your DMs, anywhere`,
      $localize`:@@feat.storefront.c5:Built for a phone, where your clients already are`,
      $localize`:@@feat.storefront.c6:Free, with no cut of what you charge`,
    ],
    benefits: [
      {
        icon: '🔗',
        title: $localize`:@@feat.storefront.b1t:One link does the explaining`,
        body: $localize`:@@feat.storefront.b1b:Stop retyping your offer in DMs. Send the link and let the page answer.`,
      },
      {
        icon: '⚡',
        title: $localize`:@@feat.storefront.b2t:Booked while you sleep`,
        body: $localize`:@@feat.storefront.b2b:People find a slot and take it instead of waiting for you to reply.`,
      },
      {
        icon: '🪪',
        title: $localize`:@@feat.storefront.b3t:It looks like you`,
        body: $localize`:@@feat.storefront.b3b:Your name, your photo, your sessions. Not a listing in someone's directory.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.storefront.q1:Do I need my own website?`,
        a: $localize`:@@feat.storefront.a1:No. The storefront is the page. If you already have a site, link to it from there.`,
      },
      {
        q: $localize`:@@feat.storefront.q2:Can people book without an account?`,
        a: $localize`:@@feat.storefront.a2:They create a free account as they book, so the session lives in one place for both of you.`,
      },
      {
        q: $localize`:@@feat.storefront.q3:Is my storefront public?`,
        a: $localize`:@@feat.storefront.a3:Yes, that is the point. It is a page you can share anywhere, and you decide what is listed on it.`,
      },
    ],
    related: ['sessions', 'payments', 'community'],
    metaTitle: $localize`:@@feat.storefront.mt:Coaching storefront: a free bookable page | MotionHive`,
    metaDescription: $localize`:@@feat.storefront.md:Get a free public coaching page where clients see your sessions and book without messaging you first. Your link, your offer, no platform fee.`,
  },
  {
    slug: 'sessions',
    name: $localize`:@@feat.sessions.name:Sessions`,
    icon: '📅',
    tone: 'amber',
    oneLiner: $localize`:@@feat.sessions.one:Class & 1:1 scheduling with bookings`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.sessions.h1a:Scheduling that`,
    h1Accent: $localize`:@@feat.sessions.h1b:fills itself.`,
    intro: $localize`:@@feat.sessions.intro:Run classes, groups and one to ones without the calendar tetris. You set what you run and when, and people take the spot themselves.`,
    capabilities: [
      $localize`:@@feat.sessions.c1:One off and recurring sessions`,
      $localize`:@@feat.sessions.c2:Class capacity with a waitlist that auto promotes`,
      $localize`:@@feat.sessions.c3:One to one bookings on your terms`,
      $localize`:@@feat.sessions.c4:In person or online, with the meeting link attached`,
      $localize`:@@feat.sessions.c5:Cancellation windows you decide`,
      $localize`:@@feat.sessions.c6:Reminders so people actually turn up`,
    ],
    benefits: [
      {
        icon: '📉',
        title: $localize`:@@feat.sessions.b1t:Fewer no shows`,
        body: $localize`:@@feat.sessions.b1b:Automatic reminders and a clear cancellation window do the nagging for you.`,
      },
      {
        icon: '🔁',
        title: $localize`:@@feat.sessions.b2t:Set the week once`,
        body: $localize`:@@feat.sessions.b2b:Recurring sessions mean you build it once, not every Sunday night.`,
      },
      {
        icon: '🧾',
        title: $localize`:@@feat.sessions.b3t:Terms as booked`,
        body: $localize`:@@feat.sessions.b3b:The price and cutoff that applied when they booked is what holds. No arguments later.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.sessions.q1:Can I run both classes and one to ones?`,
        a: $localize`:@@feat.sessions.a1:Yes. Give group sessions a capacity and keep one to ones at a single spot.`,
      },
      {
        q: $localize`:@@feat.sessions.q2:What happens when a class is full?`,
        a: $localize`:@@feat.sessions.a2:People join a waitlist, and the first in line is promoted automatically when someone cancels.`,
      },
      {
        q: $localize`:@@feat.sessions.q3:Does it handle online sessions?`,
        a: $localize`:@@feat.sessions.a3:Yes. Attach the meeting link to the session and it goes out with the booking.`,
      },
    ],
    related: ['storefront', 'programs', 'payments'],
    metaTitle: $localize`:@@feat.sessions.mt:Free class and PT scheduling for coaches | MotionHive`,
    metaDescription: $localize`:@@feat.sessions.md:Free scheduling for coaches: recurring classes, capacity and waitlists, one to one bookings, reminders and cancellation windows. No platform fee.`,
  },
  {
    slug: 'programs',
    name: $localize`:@@feat.programs.name:Programs`,
    icon: '📋',
    tone: 'amber',
    oneLiner: $localize`:@@feat.programs.one:Build training plans clients follow`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.programs.h1a:Training plans your clients`,
    h1Accent: $localize`:@@feat.programs.h1b:actually follow.`,
    intro: $localize`:@@feat.programs.intro:Build a program once and give every client a plan they can open on their own, without you narrating it down a chat thread.`,
    capabilities: [
      $localize`:@@feat.programs.c1:Build weeks and days, not spreadsheets`,
      $localize`:@@feat.programs.c2:Reuse one program across many clients`,
      $localize`:@@feat.programs.c3:Set sets, reps, load and rest per exercise`,
      $localize`:@@feat.programs.c4:Swap an exercise without rebuilding the plan`,
      $localize`:@@feat.programs.c5:Clients tick off work as they do it`,
      $localize`:@@feat.programs.c6:See who is actually training`,
    ],
    benefits: [
      {
        icon: '🧱',
        title: $localize`:@@feat.programs.b1t:Build once, reuse forever`,
        body: $localize`:@@feat.programs.b1b:Your best program becomes a template instead of a one off you rewrite each time.`,
      },
      {
        icon: '🤳',
        title: $localize`:@@feat.programs.b2t:No more "what was Tuesday?"`,
        body: $localize`:@@feat.programs.b2b:The plan lives where they train, not three weeks up a chat thread.`,
      },
      {
        icon: '👀',
        title: $localize`:@@feat.programs.b3t:You can see the truth`,
        body: $localize`:@@feat.programs.b3b:Logged work tells you who needs a nudge before they quietly drift off.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.programs.q1:Can I reuse a program for more than one client?`,
        a: $localize`:@@feat.programs.a1:Yes. Build it once, assign it to whoever it suits, and adjust it per person from there.`,
      },
      {
        q: $localize`:@@feat.programs.q2:Can clients see it on their phone?`,
        a: $localize`:@@feat.programs.a2:Yes. They open their week and work through it, ticking sets as they go.`,
      },
      {
        q: $localize`:@@feat.programs.q3:What if someone needs a different exercise?`,
        a: $localize`:@@feat.programs.a3:Swap it on their copy. The original program stays intact for everyone else.`,
      },
    ],
    related: ['exercises', 'sessions', 'messaging'],
    metaTitle: $localize`:@@feat.programs.mt:Free workout program builder for coaches | MotionHive`,
    metaDescription: $localize`:@@feat.programs.md:Build training programs clients actually follow: reusable plans, sets and reps, exercise swaps and logged work. Free, with unlimited clients.`,
  },
  {
    slug: 'exercises',
    name: $localize`:@@feat.exercises.name:Exercises`,
    icon: '🏋️',
    tone: 'amber',
    oneLiner: $localize`:@@feat.exercises.one:Your own exercise library with clips`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.exercises.h1a:Your movements, your cues,`,
    h1Accent: $localize`:@@feat.exercises.h1b:one library.`,
    intro: $localize`:@@feat.exercises.intro:Stop re explaining the same lift every week. Give every exercise one home, with your clip and the cues you actually say attached to it.`,
    capabilities: [
      $localize`:@@feat.exercises.c1:Your own library, not a stock list`,
      $localize`:@@feat.exercises.c2:Attach a clip so form is not a guess`,
      $localize`:@@feat.exercises.c3:Write the cues you actually use`,
      $localize`:@@feat.exercises.c4:Tag by muscle, kit and movement pattern`,
      $localize`:@@feat.exercises.c5:Drop exercises straight into programs`,
      $localize`:@@feat.exercises.c6:Fork a movement and make it yours`,
    ],
    benefits: [
      {
        icon: '🎥',
        title: $localize`:@@feat.exercises.b1t:Explain it once`,
        body: $localize`:@@feat.exercises.b1b:Your clip and cues travel with the exercise into every program you build.`,
      },
      {
        icon: '🔍',
        title: $localize`:@@feat.exercises.b2t:Findable in seconds`,
        body: $localize`:@@feat.exercises.b2b:Tags mean you are not scrolling a camera roll in the middle of a session.`,
      },
      {
        icon: '🗣️',
        title: $localize`:@@feat.exercises.b3t:It sounds like you`,
        body: $localize`:@@feat.exercises.b3b:Your words on the movement, not a generic description someone else wrote.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.exercises.q1:Do I have to film everything myself?`,
        a: $localize`:@@feat.exercises.a1:No. Start with what you have and add clips over time. The library works either way.`,
      },
      {
        q: $localize`:@@feat.exercises.q2:Can I change a shared exercise?`,
        a: $localize`:@@feat.exercises.a2:Fork it. You get your own copy to edit without touching the original.`,
      },
      {
        q: $localize`:@@feat.exercises.q3:Can clients see the clips?`,
        a: $localize`:@@feat.exercises.a3:Yes. The clip and cues show up right where the exercise sits in their plan.`,
      },
    ],
    related: ['programs', 'messaging', 'storefront'],
    metaTitle: $localize`:@@feat.exercises.mt:Build your own exercise library with clips | MotionHive`,
    metaDescription: $localize`:@@feat.exercises.md:Give every exercise one home: your clips, your cues, your tags, dropped straight into programs. Free for coaches, unlimited clients.`,
  },
  {
    slug: 'payments',
    name: $localize`:@@feat.payments.name:Payments`,
    icon: '💳',
    tone: 'amber',
    oneLiner: $localize`:@@feat.payments.one:Get paid, keep what you earn`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.payments.h1a:Get paid without becoming a`,
    h1Accent: $localize`:@@feat.payments.h1b:debt collector.`,
    intro: $localize`:@@feat.payments.intro:One place for what people owe you. Charge for sessions, packages or a membership, and stop chasing bank transfers on a Sunday night.`,
    capabilities: [
      $localize`:@@feat.payments.c1:Take card payments for sessions and packages`,
      $localize`:@@feat.payments.c2:Recurring memberships that renew themselves`,
      $localize`:@@feat.payments.c3:Send an invoice in a couple of clicks`,
      $localize`:@@feat.payments.c4:See who has paid and who has not`,
      $localize`:@@feat.payments.c5:Refunds inside the rules you set`,
      $localize`:@@feat.payments.c6:Keep what you earn, with no platform fee`,
    ],
    benefits: [
      {
        icon: '🧘',
        title: $localize`:@@feat.payments.b1t:No more month end chasing`,
        body: $localize`:@@feat.payments.b1b:Reminders go out on their own, so you stay the coach instead of the collector.`,
      },
      {
        icon: '🔄',
        title: $localize`:@@feat.payments.b2t:Memberships that just run`,
        body: $localize`:@@feat.payments.b2b:Recurring plans renew without you raising an invoice every month.`,
      },
      {
        icon: '💰',
        title: $localize`:@@feat.payments.b3t:Your money stays yours`,
        body: $localize`:@@feat.payments.b3b:MotionHive takes no cut. Only your payment processor charges its standard fee.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.payments.q1:Does MotionHive take a cut?`,
        a: $localize`:@@feat.payments.a1:No. There is no platform fee. Your payment processor charges its standard fee, and that is the only cost.`,
      },
      {
        q: $localize`:@@feat.payments.q2:When do I get paid?`,
        a: $localize`:@@feat.payments.a2:Payouts follow your payment processor schedule and land straight in your account.`,
      },
      {
        q: $localize`:@@feat.payments.q3:Can I charge in my own currency?`,
        a: $localize`:@@feat.payments.a3:Yes. Your prices and payouts follow the currency your account settles in.`,
      },
    ],
    related: ['storefront', 'sessions', 'programs'],
    metaTitle: $localize`:@@feat.payments.mt:Take payments and memberships, no platform fee | MotionHive`,
    metaDescription: $localize`:@@feat.payments.md:Charge for sessions, packages and memberships, send invoices, and stop chasing transfers. MotionHive takes no platform fee on what you earn.`,
  },
  {
    slug: 'messaging',
    name: $localize`:@@feat.messaging.name:Messaging`,
    icon: '💬',
    tone: 'teal',
    oneLiner: $localize`:@@feat.messaging.one:Stay close between sessions`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.messaging.h1a:Stay close between`,
    h1Accent: $localize`:@@feat.messaging.h1b:sessions.`,
    intro: $localize`:@@feat.messaging.intro:The small human touches are what keep people coming back. Keep them in the same place as the training, instead of an app where the thread disappears.`,
    capabilities: [
      $localize`:@@feat.messaging.c1:Message clients one to one`,
      $localize`:@@feat.messaging.c2:Talk to a whole group at once`,
      $localize`:@@feat.messaging.c3:The plan sits next to the conversation`,
      $localize`:@@feat.messaging.c4:Share a clip or a correction in seconds`,
      $localize`:@@feat.messaging.c5:Nothing buried under family photos`,
      $localize`:@@feat.messaging.c6:Free, for as many clients as you coach`,
    ],
    benefits: [
      {
        icon: '🎯',
        title: $localize`:@@feat.messaging.b1t:Coaching, not admin`,
        body: $localize`:@@feat.messaging.b1b:The plan is right there, so a check in takes seconds instead of a search.`,
      },
      {
        icon: '🫶',
        title: $localize`:@@feat.messaging.b2t:People feel seen`,
        body: $localize`:@@feat.messaging.b2b:A quick note about last week's cranky knee is what keeps clients around.`,
      },
      {
        icon: '📥',
        title: $localize`:@@feat.messaging.b3t:One inbox`,
        body: $localize`:@@feat.messaging.b3b:Stop losing threads across three apps and a comment section.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.messaging.q1:Does this replace WhatsApp?`,
        a: $localize`:@@feat.messaging.a1:For coaching, yes. Keeping the conversation next to the training is the whole point.`,
      },
      {
        q: $localize`:@@feat.messaging.q2:Can I message a whole group?`,
        a: $localize`:@@feat.messaging.a2:Yes. Talk to a group at once, or to one person privately.`,
      },
      {
        q: $localize`:@@feat.messaging.q3:Is there a client limit?`,
        a: $localize`:@@feat.messaging.a3:No. Message as many people as you coach.`,
      },
    ],
    related: ['community', 'programs', 'sessions'],
    metaTitle: $localize`:@@feat.messaging.mt:Message clients where the training lives | MotionHive`,
    metaDescription: $localize`:@@feat.messaging.md:Keep coach and client conversations next to the plan: one to one and group messaging, free, with no client limit.`,
  },
  {
    slug: 'community',
    name: $localize`:@@feat.community.name:Community`,
    icon: '👥',
    tone: 'teal',
    oneLiner: $localize`:@@feat.community.one:Groups and the hive, not a spreadsheet`,
    preview: null,
    poster: null,
    h1Lead: $localize`:@@feat.community.h1a:A hive, not a`,
    h1Accent: $localize`:@@feat.community.h1b:spreadsheet.`,
    intro: $localize`:@@feat.community.intro:People stay for the room, not only the program. Groups give your clients somewhere to belong instead of being a list of names in a file.`,
    capabilities: [
      $localize`:@@feat.community.c1:Create groups around what you run`,
      $localize`:@@feat.community.c2:Invite people with a link`,
      $localize`:@@feat.community.c3:Share updates the whole group sees`,
      $localize`:@@feat.community.c4:Approve who joins, if you want to`,
      $localize`:@@feat.community.c5:Sessions and posts in the same place`,
      $localize`:@@feat.community.c6:Works at five clients and at fifty`,
    ],
    benefits: [
      {
        icon: '🔥',
        title: $localize`:@@feat.community.b1t:Retention comes from the room`,
        body: $localize`:@@feat.community.b1b:People stick around for the others, not only for you.`,
      },
      {
        icon: '📣',
        title: $localize`:@@feat.community.b2t:Say it once`,
        body: $localize`:@@feat.community.b2b:One update reaches the group instead of ten separate messages.`,
      },
      {
        icon: '🌱',
        title: $localize`:@@feat.community.b3t:It scales with you`,
        body: $localize`:@@feat.community.b3b:The same space works for a handful of regulars and for a full community.`,
      },
    ],
    faq: [
      {
        q: $localize`:@@feat.community.q1:Can I control who joins?`,
        a: $localize`:@@feat.community.a1:Yes. Use an open link, or review each request before you let someone in.`,
      },
      {
        q: $localize`:@@feat.community.q2:Is a group the same as a class?`,
        a: $localize`:@@feat.community.a2:No. The group is the room. Sessions are what you run inside it.`,
      },
      {
        q: $localize`:@@feat.community.q3:Can members talk to each other?`,
        a: $localize`:@@feat.community.a3:Yes, and that is the point. The room is what keeps people coming back.`,
      },
    ],
    related: ['messaging', 'sessions', 'storefront'],
    metaTitle: $localize`:@@feat.community.mt:Groups and community for coaches, free | MotionHive`,
    metaDescription: $localize`:@@feat.community.md:Give clients a room to belong to: groups, invite links, updates and join approvals. Free for coaches, with no client limit.`,
  },
];

/** Lookup used by the /features/:slug page. */
export function featureBySlug(slug: string): MarketingFeature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

/** The 3 cross-linked features at the bottom of a feature page. */
export function relatedFeatures(f: MarketingFeature): MarketingFeature[] {
  return f.related
    .map((s) => featureBySlug(s))
    .filter((x): x is MarketingFeature => x !== undefined);
}
