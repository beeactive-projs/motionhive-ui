import ActivityKit
import Capacitor
import Foundation

/// The workout on the lock screen and in the Dynamic Island: starts, updates
/// and ends the `RestTimerAttributes` Live Activity, and hands the web side
/// what its buttons did (`RestTimerActions`). The web side is
/// `projects/mobile/src/app/_shared/native/rest-live.ts`; registered in
/// `MainViewController`.
///
/// Live Activities need iOS 16.2 (buttons, iOS 17). Before that, and when the
/// person turned them off in Settings, every method resolves and nothing shows.
@objc(RestLivePlugin)
public class RestLivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestLivePlugin"
    public let jsName = "RestLive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise)
    ]

    private var observer: NSObjectProtocol?

    override public func load() {
        // A button tapped while the web side runs: it comes to take the notes.
        observer = NotificationCenter.default.addObserver(
            forName: RestTimerActions.changed,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("action", data: [:])
        }
    }


    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    /// Starts the activity for this workout, or brings the running one up to date.
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        guard let logId = call.getString("logId"), !logId.isEmpty else {
            call.reject("logId is required")
            return
        }
        let state = Self.state(from: call)
        Task {
            await Self.show(logId: logId, state: state)
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            for activity in Activity<RestTimerAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    /// What the buttons did since the last time, oldest first, handed over once.
    @objc func takeActions(_ call: CAPPluginCall) {
        call.resolve(["actions": RestTimerActions.take()])
    }

    @available(iOS 16.2, *)
    private static func show(logId: String, state incoming: RestTimerAttributes.ContentState) async {
        var state = incoming
        let running = Activity<RestTimerAttributes>.activities
        if let current = running.first(where: { $0.attributes.logId == logId }) {
            // A button changed the rest and the web side has not taken the
            // note yet: until it does, the rest on the lock screen is the true one.
            if !RestTimerActions.pending().isEmpty {
                state.restStartedAt = current.content.state.restStartedAt
                state.restEndsAt = current.content.state.restEndsAt
            }
            await current.update(ActivityContent(state: state, staleDate: staleDate(state)))
            return
        }
        for activity in running {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            _ = try Activity.request(
                attributes: RestTimerAttributes(logId: logId),
                content: ActivityContent(state: state, staleDate: staleDate(state)),
                pushType: nil
            )
        } catch {
            // Only from the foreground, and never past the system's limit:
            // the workout goes on in the app either way.
            CAPLog.print("RestLive: could not start the Live Activity: \(error.localizedDescription)")
        }
    }

    /// Go shows when the rest's end passes; an end already past is drawn as
    /// Go from the start, and a stale date in the past stops it starting.
    @available(iOS 16.1, *)
    private static func staleDate(_ state: RestTimerAttributes.ContentState) -> Date? {
        guard let end = state.restEndsAt, end > Date() else { return nil }
        return end
    }

    /// Times arrive as epoch milliseconds, null when there is none.
    @available(iOS 16.1, *)
    private static func state(from call: CAPPluginCall) -> RestTimerAttributes.ContentState {
        func date(_ key: String) -> Date? {
            call.getDouble(key).map { Date(timeIntervalSince1970: $0 / 1000) }
        }
        let labels = call.getObject("labels") ?? [:]
        func label(_ key: String) -> String { labels[key] as? String ?? "" }
        return RestTimerAttributes.ContentState(
            title: call.getString("title") ?? "",
            restStartedAt: date("restStartedAt"),
            restEndsAt: date("restEndsAt"),
            clockFrom: date("clockFrom"),
            pausedSeconds: call.getInt("pausedSeconds"),
            restLine: call.getString("restLine") ?? "",
            goLine: call.getString("goLine") ?? "",
            workoutLine: call.getString("workoutLine") ?? "",
            exercise: call.getString("exercise"),
            setName: call.getString("set"),
            target: call.getString("target"),
            aim: call.getString("aim"),
            last: call.getString("last"),
            done: call.getInt("done"),
            total: call.getInt("total"),
            progress: call.getString("progress"),
            planned: call.getString("planned"),
            kicker: call.getString("kicker"),
            order: call.getString("order"),
            labels: RestTimerAttributes.Labels(
                go: label("go"),
                skip: label("skip"),
                startSet: label("startSet"),
                paused: label("paused"),
                rest: label("rest"),
                restOver: label("restOver"),
                workout: label("workout"),
                done: label("done"),
                next: label("next"),
                more: label("more")
            )
        )
    }
}
