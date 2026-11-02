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
        guard let activity = Activity<RestTimerAttributes>.activities.first else { return }
        var state = activity.content.state
        guard let end = state.restEndsAt else { return }
        let endsAt = max(Date(), end.addingTimeInterval(nudgeSeconds))
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

    /// The alert keeps what Capacitor put in it (its text, its data); only the moment changes.
    private static func moveRestAlert(to date: Date) async {
        let center = UNUserNotificationCenter.current()
        let requests = await center.pendingNotificationRequests()
        guard let request = requests.first(where: { $0.identifier == restAlertId }) else { return }
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSinceNow),
            repeats: false
        )
        try? await center.add(
            UNNotificationRequest(identifier: request.identifier, content: request.content, trigger: trigger)
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
