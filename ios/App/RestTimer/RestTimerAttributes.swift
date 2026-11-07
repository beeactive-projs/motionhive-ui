import ActivityKit
import Foundation

/// The workout in progress on the lock screen and in the Dynamic Island
/// (Workouts R2, section 13). Compiled into both the app, which starts and
/// updates it (`RestLivePlugin`), and the `RestTimerExtension` widget, which
/// draws it (`RestTimerWidget`).
///
/// Every time on it is a date the system counts to or from, so nothing has
/// to run for the clock to stay right while the phone is locked.
@available(iOS 16.1, *)
struct RestTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// The workout's name.
        var title: String
        /// The rest running: when it began and when it ends. Both nil between sets.
        var restStartedAt: Date?
        var restEndsAt: Date?
        /// The workout clock counts up from here: its start, moved on by the
        /// time it spent paused. Nil while paused.
        var clockFrom: Date?
        /// What the clock says while paused, in seconds.
        var pausedSeconds: Int?
        /// "Rest · next Set 3 · Bench press", under the countdown.
        var restLine: String
        /// "Set 3 · 62.5 kg × 8 · Bench press", under Go once the rest is over.
        var goLine: String
        /// "Next: Set 3 · Bench press", under the workout clock.
        var workoutLine: String
        /// The next set in pieces, for the layouts that cut the name before
        /// the weight. Nil or empty when the app has not said: the lines
        /// above stand in. Optional, so a state from an older app still reads.
        var exercise: String?
        /// "Set 2", "Warm-up", "Round 2".
        var setName: String?
        /// "62.5 kg × 8".
        var target: String?
        /// "Target 62.5 kg × 8", between sets.
        var aim: String?
        /// "last 60 × 8".
        var last: String?
        /// Sets of this exercise ticked, of how many (rounds, in a superset).
        var done: Int?
        var total: Int?
        /// "7 of 13 sets", beside the workout clock.
        var progress: String?
        /// "of 2:00", beside the countdown.
        var planned: String?
        /// In a superset: "Superset · round 2 of 3", and the round in order.
        var kicker: String?
        var order: String?
        var labels: Labels
    }

    /// The words on it, in the person's language, sent by the app.
    struct Labels: Codable, Hashable {
        var go: String
        var skip: String
        var startSet: String
        var paused: String
        /// Optional, as the fields above.
        var rest: String?
        var restOver: String?
        var workout: String?
        var done: String?
        var next: String?
        var more: String?
    }

    /// The workout log it belongs to: another workout starts another activity.
    var logId: String
}
