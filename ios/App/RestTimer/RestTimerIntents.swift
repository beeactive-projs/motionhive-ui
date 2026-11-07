import ActivityKit
import AppIntents
import Foundation
import UserNotifications

/// What the lock screen buttons do. A `LiveActivityIntent` runs in the app's
/// process (woken in the background if need be), which is why this file is
/// in both targets: the widget needs the intent types for its buttons, the
/// app runs them.
///
/// Each one changes the Live Activity at once, moves or withdraws the
/// rest-over alert `RestAlertService` scheduled, and leaves a note of what
/// happened for the web side, which picks it up (`RestLivePlugin.takeActions`)
/// the moment it runs again and records the rest as if the bar had been tapped.
enum RestTimerActions {
    /// The notes, oldest first, until the web side takes them.
    static let queueKey = "mh.restTimer.actions"
    /// Posted after every note, for a web side that is running.
    static let changed = Notification.Name("MHRestTimerActionsChanged")
    /// The id `RestAlertService` schedules the rest-over alert under
    /// (`REST_NOTIFICATION_ID`); Capacitor uses it as the request identifier.
    static let restAlertId = "1"
    /// The same nudge as the rest bar's (`NUDGE_SECONDS`).
    static let nudgeSeconds: TimeInterval = 15
    /// "+30 s" once the rest is over (`MORE_REST_SECONDS`).
    static let moreSeconds: TimeInterval = 30

    static func pending() -> [[String: Any]] {
        UserDefaults.standard.array(forKey: queueKey) as? [[String: Any]] ?? []
    }

    /// The notes, handed over once.
    static func take() -> [[String: Any]] {
        let actions = pending()
        UserDefaults.standard.removeObject(forKey: queueKey)
        return actions
    }

    static func milliseconds(_ date: Date) -> Double {
        (date.timeIntervalSince1970 * 1000).rounded()
    }

    private static func record(_ action: [String: Any]) {
        UserDefaults.standard.set(pending() + [action], forKey: queueKey)
        NotificationCenter.default.post(name: changed, object: nil)
    }

    /// +15: the rest ends 15 seconds later, never before now (as the bar's +15).
    @available(iOS 16.2, *)
    static func extend() async {
        guard let end = currentEnd() else { return }
        await moveRest(to: max(Date(), end.addingTimeInterval(nudgeSeconds)))
    }

    /// −15: the rest ends 15 seconds sooner; at or past now, it is over, as Skip.
    @available(iOS 16.2, *)
    static func shorten() async {
        guard let end = currentEnd() else { return }
        let endsAt = end.addingTimeInterval(-nudgeSeconds)
        if endsAt <= Date().addingTimeInterval(1) {
            await endRest("skip")
            return
        }
        await moveRest(to: endsAt)
    }

    /// "+30 s" with the rest over: a little more, counted from now.
    @available(iOS 16.2, *)
    static func more() async {
        guard currentEnd() != nil else { return }
        await moveRest(to: Date().addingTimeInterval(moreSeconds))
    }

    @available(iOS 16.2, *)
    private static func currentEnd() -> Date? {
        Activity<RestTimerAttributes>.activities.first?.content.state.restEndsAt
    }

    /// The rest now ends at `endsAt`: shown at once, the alert moved, the web side told.
    @available(iOS 16.2, *)
    private static func moveRest(to endsAt: Date) async {
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        state.restEndsAt = endsAt
        await activity.update(ActivityContent(state: state, staleDate: endsAt))
        await moveRestAlert(to: endsAt)
        record(["type": "extend", "at": milliseconds(Date()), "endsAt": milliseconds(endsAt)])
    }

    /// Skip (before zero) or Start set (after): the rest ends now, and that is its length.
    @available(iOS 16.2, *)
    static func endRest(_ type: String) async {
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        guard state.restEndsAt != nil else { return }
        state.restStartedAt = nil
        state.restEndsAt = nil
        await activity.update(ActivityContent(state: state, staleDate: nil))
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [restAlertId])
        record(["type": type, "at": milliseconds(Date())])
    }

    /// ✓ on the next set: it is done as the button showed it. The set after
    /// it shows at once, with its rest counting down and the rest-over
    /// alert set for its end; the web side saves the set when it runs.
    @available(iOS 16.2, *)
    static func logSet(_ setId: String) async {
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        guard let shown = state.steps?.first, shown.setId == setId, !shown.values.isEmpty else { return }
        guard let step = state.moveOn(past: setId) else { return }
        let now = Date()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [restAlertId])
        center.removeDeliveredNotifications(withIdentifiers: [restAlertId])
        var endsAt: Date?
        if let rest = step.rest, rest > 0 {
            endsAt = now.addingTimeInterval(TimeInterval(rest))
            state.restStartedAt = now
        } else {
            state.restStartedAt = nil
        }
        state.restEndsAt = endsAt
        await activity.update(ActivityContent(state: state, staleDate: endsAt))
        if let endsAt {
            await scheduleRestAlert(at: endsAt, state: state)
        }
        record([
            "type": "log",
            "at": milliseconds(now),
            "setId": step.setId,
            "exerciseId": step.exerciseId,
            "values": step.values
        ])
    }

    /// Skip set: the next set is passed over, left unticked, and the one after shows.
    @available(iOS 16.2, *)
    static func skipSet(_ setId: String) async {
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        guard state.steps?.first?.setId == setId, state.moveOn(past: setId) != nil else { return }
        await activity.update(ActivityContent(state: state, staleDate: activity.content.staleDate))
        record(["type": "skipSet", "at": milliseconds(Date()), "setId": setId])
    }

    /// Continue on a paused workout: the clock runs again from where it stood.
    @available(iOS 16.2, *)
    static func resume() async {
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        guard state.clockFrom == nil, let seconds = state.pausedSeconds else { return }
        let now = Date()
        state.clockFrom = now.addingTimeInterval(-TimeInterval(seconds))
        state.pausedSeconds = nil
        await activity.update(ActivityContent(state: state, staleDate: nil))
        record(["type": "resume", "at": milliseconds(now)])
    }

    /// The rest-over alert for a rest the lock screen started: the next set
    /// as its text, as `RestAlertService` writes it. Nothing when the person
    /// did not allow notifications.
    @available(iOS 16.2, *)
    private static func scheduleRestAlert(at date: Date, state: RestTimerAttributes.ContentState) async {
        let content = UNMutableNotificationContent()
        var title = state.labels.alertTitle ?? ""
        if title.isEmpty {
            title = state.labels.restOver ?? ""
        }
        var body = ""
        if let next = state.steps?.first {
            body = next.line
        }
        if body.isEmpty {
            body = state.labels.alertBody ?? ""
        }
        content.title = title
        content.body = body
        content.sound = .default
        // The shape Capacitor gives its own, so a tap on it reads like theirs.
        content.userInfo = ["cap_schedule": [String: Any]()]
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSinceNow),
            repeats: false
        )
        try? await UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: restAlertId, content: content, trigger: trigger)
        )
    }

    /// The alert keeps what Capacitor put in it (its text, its data); only the
    /// moment changes. After "+30 s" it has already gone off: the one shown is
    /// taken down and comes again at the new end.
    private static func moveRestAlert(to date: Date) async {
        let center = UNUserNotificationCenter.current()
        var content: UNNotificationContent?
        let pending = await center.pendingNotificationRequests()
        if let request = pending.first(where: { $0.identifier == restAlertId }) {
            content = request.content
        } else {
            let shown = await center.deliveredNotifications()
            if let notification = shown.first(where: { $0.request.identifier == restAlertId }) {
                content = notification.request.content
                center.removeDeliveredNotifications(withIdentifiers: [restAlertId])
            }
        }
        guard let content else { return }
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSinceNow),
            repeats: false
        )
        try? await center.add(
            UNNotificationRequest(identifier: restAlertId, content: content, trigger: trigger)
        )
    }
}

// The titles never show: the intents are not offered in Shortcuts or Spotlight.

@available(iOS 17.0, *)
struct ExtendRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Add 15 seconds of rest"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.extend()
        return .result()
    }
}

@available(iOS 17.0, *)
struct ShortenRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Take 15 seconds off the rest"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.shorten()
        return .result()
    }
}

@available(iOS 17.0, *)
struct MoreRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Rest 30 seconds more"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.more()
        return .result()
    }
}

@available(iOS 17.0, *)
struct SkipRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Skip the rest"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.endRest("skip")
        return .result()
    }
}

@available(iOS 17.0, *)
struct StartSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Start the next set"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.endRest("start")
        return .result()
    }
}

@available(iOS 17.0, *)
struct LogSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Log the next set as planned"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Set")
    var setId: String

    init() {}

    init(setId: String) {
        self.setId = setId
    }

    func perform() async throws -> some IntentResult {
        await RestTimerActions.logSet(setId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct SkipSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Skip the next set"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Set")
    var setId: String

    init() {}

    init(setId: String) {
        self.setId = setId
    }

    func perform() async throws -> some IntentResult {
        await RestTimerActions.skipSet(setId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct ResumeWorkoutIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Continue the workout"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RestTimerActions.resume()
        return .result()
    }
}
