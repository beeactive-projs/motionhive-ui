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
        var labels: Labels
    }

    /// The words on it, in the person's language, sent by the app.
    struct Labels: Codable, Hashable {
        var go: String
        var skip: String
        var startSet: String
        var paused: String
    }

    /// The workout log it belongs to: another workout starts another activity.
    var logId: String
}
