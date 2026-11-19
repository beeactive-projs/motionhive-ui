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
        /// The next set and the ones after it, for the buttons that act with
        /// the app asleep: ✓ saves the first one and starts its rest, Skip
        /// set passes it over; either then shows the one after.
        var steps: [Step]?
        var labels: Labels

        /// ✓ or Skip set moved on past `setId`: the step after it is shown,
        /// and the step moved past is handed back. Nil when it is not here.
        mutating func moveOn(past setId: String) -> Step? {
            guard let steps, let at = steps.firstIndex(where: { $0.setId == setId }) else {
                return nil
            }
            let step = steps[at]
            let ahead = Array(steps.dropFirst(at + 1))
            self.steps = ahead
            restLine = ""
            goLine = ""
            workoutLine = ""
            if let next = ahead.first {
                show(next)
            } else {
                show(nil)
                if step.final {
                    workoutLine = labels.allDone ?? ""
                }
            }
            return step
        }

        private mutating func show(_ step: Step?) {
            exercise = step?.exercise
            setName = step?.setName
            target = step?.target
            aim = step?.aim
            last = step?.last
            done = step?.done
            total = step?.total
            progress = step?.progress
            kicker = step?.kicker
            order = step?.order
            planned = nil
        }
    }

    /// One set to come: what is shown once it is the next one, and what the
    /// buttons need to act on it.
    struct Step: Codable, Hashable {
        var setId: String
        var exerciseId: String
        /// What ✓ saves (`weightKg`, `reps`, `durationSeconds`, `distanceMeters`).
        /// Empty when nothing is planned: no ✓ then.
        var values: [String: Double]
        /// The values, short, on the ✓ button: "62.5 × 8".
        var short: String
        /// The rest once it is ticked, in seconds; nil when none starts.
        var rest: Int?
        /// "Set 3 · 62.5 kg × 8 · Bench press": the rest-over alert before it.
        var line: String
        /// Nothing is left to do after it.
        var final: Bool
        var exercise: String?
        var setName: String?
        var target: String?
        var aim: String?
        var last: String?
        var done: Int?
        var total: Int?
        var progress: String?
        var kicker: String?
        var order: String?
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
        var open: String?
        var skipSet: String?
        var otherValue: String?
        var resume: String?
        var allDone: String?
        var alertTitle: String?
        var alertBody: String?
    }

    /// The workout log it belongs to: another workout starts another activity.
    var logId: String
}
