import ActivityKit
import SwiftUI
import WidgetKit

/// The lock screen and Dynamic Island face of the workout in progress
/// (Workouts R2, Active Workout, "Outside the app"): a draining hexagon and
/// the countdown while resting, a green Go at zero, an outlined hexagon and
/// the workout clock between sets. The system draws every timer from the
/// dates in the state, so it stays right with the app asleep.
@main
struct RestTimerBundle: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivity()
    }
}

private enum Palette {
    /// The app's honey, `--mh-honey`.
    static let honey = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)
    static let go = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
    static let card = Color(red: 28 / 255, green: 29 / 255, blue: 32 / 255)
    static let chip = Color.white.opacity(0.14)
    static let muted = Color.white.opacity(0.62)
    /// Text on honey, as on the app's honey buttons.
    static let ink = Color(red: 14 / 255, green: 27 / 255, blue: 49 / 255)
}

/// Which face to show, worked out from the dates when the system draws it.
/// The rest turns to Go when its end passes (the state's stale date).
private enum Phase {
    case rest(ClosedRange<Date>)
    case go
    case workout(from: Date)
    case paused(seconds: Int)

    init(_ state: RestTimerAttributes.ContentState, stale: Bool) {
        if let end = state.restEndsAt {
            let start = min(state.restStartedAt ?? end, end)
            self = stale || end <= Date() ? .go : .rest(start...end)
        } else if let from = state.clockFrom {
            self = .workout(from: from)
        } else {
            self = .paused(seconds: state.pausedSeconds ?? 0)
        }
    }
}

struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            LockScreenView(state: context.state, phase: Phase(context.state, stale: context.isStale))
                .activityBackgroundTint(Palette.card)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let state = context.state
            let phase = Phase(state, stale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    TimerHex(phase: phase, size: 34).padding(.leading, 6).padding(.top, 2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Clock(state: state, phase: phase)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(state.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 10) {
                        Text(line(state, phase))
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.muted)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Actions(state: state, phase: phase)
                    }
                    .padding(.horizontal, 6)
                }
            } compactLeading: {
                TimerHex(phase: phase, size: 20).padding(.leading, 2)
            } compactTrailing: {
                CompactClock(state: state, phase: phase)
            } minimal: {
                TimerHex(phase: phase, size: 20)
            }
            .keylineTint(Palette.honey)
        }
    }
}

/// The line under the big text.
private func line(_ state: RestTimerAttributes.ContentState, _ phase: Phase) -> String {
    switch phase {
    case .rest: return state.restLine
    case .go: return state.goLine
    case .workout: return state.workoutLine
    case .paused: return state.labels.paused
    }
}

/// "1:05:12" past an hour, "31:40" before, as the app's `workoutClock`.
private func clockText(_ seconds: Int) -> String {
    let hours = seconds / 3600
    let minutes = (seconds / 60) % 60
    let rest = seconds % 60
    return hours > 0
        ? String(format: "%d:%02d:%02d", hours, minutes, rest)
        : String(format: "%d:%02d", minutes, rest)
}

private struct LockScreenView: View {
    let state: RestTimerAttributes.ContentState
    let phase: Phase

    var body: some View {
        HStack(spacing: 12) {
            TimerHex(phase: phase, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Headline(state: state, phase: phase)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                let text = line(state, phase)
                if !text.isEmpty {
                    Text(text)
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Actions(state: state, phase: phase)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

/// The big text: the countdown, Go, or the workout's name and clock.
private struct Headline: View {
    let state: RestTimerAttributes.ContentState
    let phase: Phase

    var body: some View {
        switch phase {
        case .rest, .go:
            Clock(state: state, phase: phase)
        case .workout, .paused:
            HStack(spacing: 0) {
                Text(state.title).lineLimit(1)
                Text(" · ")
                Clock(state: state, phase: phase).fixedSize()
            }
        }
    }
}

/// The time alone: what is left of the rest, Go, or the workout's time.
private struct Clock: View {
    let state: RestTimerAttributes.ContentState
    let phase: Phase

    var body: some View {
        switch phase {
        case let .rest(range):
            Text(timerInterval: range, countsDown: true).monospacedDigit()
        case .go:
            Text(state.labels.go)
        case let .workout(from):
            Text(from, style: .timer).monospacedDigit()
        case let .paused(seconds):
            Text(clockText(seconds)).monospacedDigit()
        }
    }
}

/// Beside the camera: narrow, so the timer is held to a width it fits.
private struct CompactClock: View {
    let state: RestTimerAttributes.ContentState
    let phase: Phase

    var body: some View {
        Group {
            switch phase {
            case .rest:
                Clock(state: state, phase: phase).foregroundStyle(Palette.honey)
            case .go:
                Clock(state: state, phase: phase).foregroundStyle(Palette.go)
            case .workout, .paused:
                Clock(state: state, phase: phase).foregroundStyle(.white)
            }
        }
        .font(.system(size: 15, weight: .semibold, design: .rounded))
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 52, alignment: .trailing)
    }
}

/// +15 and Skip while resting, Start set at zero. Buttons need iOS 17;
/// before that, a tap on the activity opens the app.
private struct Actions: View {
    let state: RestTimerAttributes.ContentState
    let phase: Phase

    var body: some View {
        if #available(iOS 17.0, *) {
            switch phase {
            case .rest:
                HStack(spacing: 6) {
                    Button(intent: ExtendRestIntent()) { Chip(text: "+15") }
                        .buttonStyle(.plain)
                    Button(intent: SkipRestIntent()) { Chip(text: state.labels.skip) }
                        .buttonStyle(.plain)
                }
            case .go:
                Button(intent: StartSetIntent()) { Chip(text: state.labels.startSet, primary: true) }
                    .buttonStyle(.plain)
            case .workout, .paused:
                EmptyView()
            }
        }
    }
}

private struct Chip: View {
    let text: String
    var primary = false

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
            .foregroundStyle(primary ? Palette.ink : .white)
            .padding(.horizontal, 11)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(primary ? Palette.honey : Palette.chip)
            )
    }
}

/// The timer hexagon (the logo's, as the rest bar's): filled and draining
/// while resting, green with a tick at Go, an outline for the workout clock.
private struct TimerHex: View {
    let phase: Phase
    /// Point to point.
    let size: CGFloat

    private var width: CGFloat { size * LogoHexagon.ratio }

    var body: some View {
        ZStack {
            switch phase {
            case let .rest(range):
                LogoHexagon().fill(Palette.chip)
                // The system's own progress, turned upright and cut to the
                // hexagon: it drains from the top with nothing running.
                ProgressView(timerInterval: range, countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.linear)
                .tint(Palette.honey)
                .frame(width: size)
                .scaleEffect(x: 1, y: width, anchor: .center)
                .rotationEffect(.degrees(-90))
                .frame(width: width, height: size)
                .mask(LogoHexagon())
            case .go:
                LogoHexagon().fill(Palette.go)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.38, weight: .heavy))
                    .foregroundStyle(.white)
            case .workout:
                LogoHexagon().strokeBorder(Palette.honey, lineWidth: max(1.5, size * 0.07))
            case .paused:
                LogoHexagon().strokeBorder(Palette.muted, lineWidth: max(1.5, size * 0.07))
            }
        }
        .frame(width: width, height: size)
    }
}

/// The logo's hexagon standing on a point, 8 : 9, its corners cut back 6%
/// of the width and rounded: `hexPath` in the app's `hexagon.config.ts`.
private struct LogoHexagon: InsettableShape {
    static let ratio: CGFloat = 8 / 9
    private static let cut: CGFloat = 0.06

    var inset: CGFloat = 0

    func inset(by amount: CGFloat) -> LogoHexagon {
        LogoHexagon(inset: inset + amount)
    }

    func path(in rect: CGRect) -> Path {
        let box = rect.insetBy(dx: inset, dy: inset)
        let w = box.width
        let h = box.height
        let vertices = [
            CGPoint(x: w / 2, y: 0), CGPoint(x: w, y: h / 4), CGPoint(x: w, y: 3 * h / 4),
            CGPoint(x: w / 2, y: h), CGPoint(x: 0, y: 3 * h / 4), CGPoint(x: 0, y: h / 4),
        ].map { CGPoint(x: $0.x + box.minX, y: $0.y + box.minY) }
        let length = Self.cut * w
        func toward(_ from: CGPoint, _ to: CGPoint) -> CGPoint {
            let t = length / hypot(to.x - from.x, to.y - from.y)
            return CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        }
        var path = Path()
        for index in vertices.indices {
            let vertex = vertices[index]
            let before = vertices[(index + 5) % 6]
            let after = vertices[(index + 1) % 6]
            let enter = toward(vertex, before)
            if index == 0 { path.move(to: enter) } else { path.addLine(to: enter) }
            path.addQuadCurve(to: toward(vertex, after), control: vertex)
        }
        path.closeSubpath()
        return path
    }
}
