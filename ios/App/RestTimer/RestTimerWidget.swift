import ActivityKit
import SwiftUI
import WidgetKit

/// The lock screen and Dynamic Island face of the workout in progress
/// (Workouts R2, Active Workout, "Outside the app"; the Live Activity design:
/// rich and standard layouts, the same states). Four states: the rest
/// counting down, the rest over, between sets with the workout clock, and
/// paused, each with its buttons. The system draws every timer from the
/// dates in the state, so it stays right with the app asleep.
///
@main
struct RestTimerBundle: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivity()
    }
}

private enum Palette {
    /// The app's honey, `--mh-honey`.
    static let honey = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)
    /// The next set's dot, a lighter honey.
    static let honeyLight = Color(red: 253 / 255, green: 230 / 255, blue: 138 / 255)
    static let go = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
    /// "Done" on navy, lighter than the hexagon's green so it reads as text.
    static let goText = Color(red: 74 / 255, green: 222 / 255, blue: 128 / 255)
    /// The app's navy, opaque in light and dark, so no wallpaper shows through.
    static let card = Color(red: 14 / 255, green: 27 / 255, blue: 49 / 255)
    static let chip = Color.white.opacity(0.14)
    static let muted = Color(red: 159 / 255, green: 179 / 255, blue: 200 / 255)
    /// Text on honey, as on the app's honey buttons.
    static let ink = card
}

/// Which face to show, worked out from the dates when the system draws it.
/// The rest turns to "Done" when its end passes (the state's stale date).
private enum Phase {
    case rest(ClosedRange<Date>)
    case go(since: Date)
    case workout(from: Date)
    case paused(seconds: Int)

    init(_ state: RestTimerAttributes.ContentState, stale: Bool) {
        if let end = state.restEndsAt {
            let start = min(state.restStartedAt ?? end, end)
            if stale || end <= Date() {
                self = .go(since: end)
            } else {
                self = .rest(start...end)
            }
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
            RichView(face: Face(
                state: context.state,
                phase: Phase(context.state, stale: context.isStale),
                logId: context.attributes.logId
            ))
                .activityBackgroundTint(Palette.card)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let face = Face(
                state: context.state,
                phase: Phase(context.state, stale: context.isStale),
                logId: context.attributes.logId
            )
            return DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    Text(face.kicker)
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // The time goes down here, across the island: beside the
                    // camera there is no room for a clock past ten minutes.
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .center, spacing: 12) {
                            TimerHex(phase: face.phase, size: 32)
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    BigNumber(face: face, size: 26)
                                        .multilineTextAlignment(.leading)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    if !face.aside.isEmpty {
                                        Text(face.aside)
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Palette.muted)
                                            .lineLimit(1)
                                            .fixedSize()
                                    }
                                }
                                if case let .rest(range) = face.phase {
                                    RestBar(range: range)
                                }
                            }
                        }
                        if face.showsNextLine {
                            NextLine(face: face, size: 13)
                        }
                        Actions(face: face, limit: 2)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                TimerHex(phase: face.phase, size: 18).padding(.leading, 2)
            } compactTrailing: {
                CompactClock(face: face)
            } minimal: {
                TimerHex(phase: face.phase, size: 18)
            }
            .keylineTint(Palette.honey)
        }
    }
}

/// What every layout reads: the state, the phase, and the texts worked out once.
private struct Face {
    let state: RestTimerAttributes.ContentState
    let phase: Phase
    /// The workout, for the link that opens it on the next set.
    let logId: String

    private func text(_ value: String?) -> String {
        value ?? ""
    }

    var exercise: String { text(state.exercise) }
    var setName: String { text(state.setName) }
    var target: String { text(state.target) }
    /// True when the app sent the next set in pieces; otherwise the old lines stand in.
    var hasPieces: Bool { !exercise.isEmpty }
    var order: String { text(state.order) }
    var isSuperset: Bool { !order.isEmpty }

    /// The small line above the big number.
    var kicker: String {
        switch phase {
        case .rest:
            let superset = text(state.kicker)
            if !superset.isEmpty {
                return superset.uppercased()
            }
            return orFallback(state.labels.rest, "Rest").uppercased()
        case .go:
            return orFallback(state.labels.restOver, "Rest over").uppercased()
        case .workout:
            return joined([state.title, text(state.labels.workout)]).uppercased()
        case .paused:
            return joined([state.title, state.labels.paused]).uppercased()
        }
    }

    /// Beside the big number: "of 2:00", or "7 of 13 sets".
    var aside: String {
        switch phase {
        case .rest:
            return text(state.planned)
        case .go:
            return ""
        case .workout, .paused:
            return text(state.progress)
        }
    }

    /// The line under it, at the smaller size: last time, or the target and last time.
    var detail: String {
        if !hasPieces {
            return ""
        }
        switch phase {
        case .rest, .go:
            if isSuperset {
                return ""
            }
            return text(state.last)
        case .workout, .paused:
            return joined([text(state.aim), text(state.last)])
        }
    }

    /// One line, for the standard layout, the Dynamic Island and an app that sent no pieces.
    var oneLine: String {
        switch phase {
        case .rest:
            if hasPieces {
                return "\(nextLabel): \(theSet)"
            }
            return state.restLine
        case .go:
            if hasPieces {
                return theSet
            }
            return state.goLine
        case .workout:
            if hasPieces {
                return joined([setName, text(state.progress)])
            }
            return state.workoutLine
        case .paused:
            return state.labels.paused
        }
    }

    /// The set to do, on one line: the round in order, in a superset.
    private var theSet: String {
        if isSuperset {
            return order
        }
        return joined([exercise, setName, target])
    }

    /// The set the buttons act on: the next one, when the app sent it.
    var step: RestTimerAttributes.Step? { state.steps?.first }

    /// ✓ needs values to save, and says them on the button.
    var canLog: Bool {
        guard let step else { return false }
        return !step.values.isEmpty && !step.short.isEmpty
    }

    var logLabel: String {
        guard let step else { return "" }
        return "✓ \(step.short)"
    }

    /// "Other value": the app, opened on the next set to type it.
    var otherValueURL: URL? {
        guard let step else { return nil }
        var link = URLComponents()
        link.scheme = "motionhive"
        link.host = "log"
        link.path = "/\(logId)"
        link.queryItems = [URLQueryItem(name: "set", value: step.setId)]
        return link.url
    }

    /// Nothing known to come and nothing to say: the line is left out.
    var showsNextLine: Bool { hasPieces || !oneLine.isEmpty }

    var nextLabel: String { orFallback(state.labels.next, "Next") }
    var doneLabel: String { orFallback(state.labels.done, state.labels.go) }

    /// The dots: sets (or rounds) done, the next one lit, as many as fit.
    var dots: (done: Int, total: Int) {
        (state.done ?? 0, state.total ?? 0)
    }

    private func orFallback(_ value: String?, _ fallback: String) -> String {
        guard let value, !value.isEmpty else { return fallback }
        return value
    }

    private func joined(_ parts: [String]) -> String {
        parts.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// "1:05:12" past an hour, "31:40" before, as the app's `workoutClock`.
private func clockText(_ seconds: Int) -> String {
    let hours = seconds / 3600
    let minutes = (seconds / 60) % 60
    let rest = seconds % 60
    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, rest)
    }
    return String(format: "%d:%02d", minutes, rest)
}

// MARK: - Lock screen

/// Three lines and up to three buttons: what the rest needs at a glance.
/// Fixed type sizes, so its height is known whatever the person's text size:
/// at most about 150 points, under the 160 the lock screen allows. Long
/// names give way on the line; the weight and the time never do.
private struct RichView: View {
    let face: Face

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .center, spacing: 12) {
                TimerHex(phase: face.phase, size: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text(face.kicker)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .tracking(0.8)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        BigNumber(face: face, size: 26)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if !face.aside.isEmpty {
                            Text(face.aside)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Palette.muted)
                                .lineLimit(1)
                                .fixedSize()
                        }
                    }
                    if case let .rest(range) = face.phase {
                        RestBar(range: range).padding(.top, 3)
                    }
                }
            }
            if face.showsNextLine {
                NextLine(face: face, size: 13)
            }
            DetailRow(face: face)
            Actions(face: face, limit: 3)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }
}

/// The big text: the countdown, "Done" and the time past it, or the workout's clock.
/// A timer takes all the width it is given, so it always sits in a bounded frame.
private struct BigNumber: View {
    let face: Face
    let size: CGFloat

    var body: some View {
        Group {
            switch face.phase {
            case let .rest(range):
                Text(timerInterval: range, countsDown: true)
                    .monospacedDigit()
                    .foregroundStyle(.white)
            case let .go(since):
                // "Done +0:25": the date counts up once it has passed.
                (Text(face.doneLabel).foregroundColor(Palette.goText)
                    + Text("  +").foregroundColor(Palette.muted)
                    + Text(since, style: .timer).foregroundColor(Palette.muted))
                    .monospacedDigit()
            case let .workout(from):
                Text(from, style: .timer)
                    .monospacedDigit()
                    .foregroundStyle(.white)
            case let .paused(seconds):
                Text(clockText(seconds))
                    .monospacedDigit()
                    .foregroundStyle(Palette.muted)
            }
        }
        .font(.system(size: size, weight: .bold, design: .rounded))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
}

/// The rest draining, honey on a faint track.
private struct RestBar: View {
    let range: ClosedRange<Date>

    var body: some View {
        ProgressView(timerInterval: range, countsDown: true) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(Palette.honey)
        .frame(height: 5)
    }
}

/// "Next: Bench press · Set 2 · 62.5 kg × 8": the name gives way first, the
/// weight never. In a superset, the whole round in order.
private struct NextLine: View {
    let face: Face
    let size: CGFloat

    private var prefix: String {
        if case .rest = face.phase {
            return "\(face.nextLabel): "
        }
        return ""
    }

    var body: some View {
        Group {
            if !face.hasPieces || face.isPausedOnly {
                Text(face.oneLine)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            } else if face.isSuperset {
                Text(prefix + face.order)
                    .foregroundStyle(.white)
                    .lineLimit(1)
            } else {
                HStack(spacing: 0) {
                    Text(prefix + face.exercise)
                        .lineLimit(1)
                    if !face.setName.isEmpty {
                        Text(" · \(face.setName)").lineLimit(1).fixedSize()
                    }
                    if face.showsTarget && !face.target.isEmpty {
                        Text(" · ").fixedSize()
                        Text(face.target)
                            .foregroundStyle(Palette.honey)
                            .lineLimit(1)
                            .fixedSize()
                    }
                }
                .foregroundStyle(.white)
            }
        }
        .font(.system(size: size, weight: .semibold))
    }
}

private extension Face {
    /// During and after the rest the weight goes on this line; between sets it is in the detail.
    var showsTarget: Bool {
        switch phase {
        case .rest, .go: return true
        case .workout, .paused: return false
        }
    }

    /// A paused workout with nothing known to come still says so.
    var isPausedOnly: Bool {
        if case .paused = phase {
            return !hasPieces
        }
        return false
    }
}

/// Last time (or the target) on the left, the dots on the right.
private struct DetailRow: View {
    let face: Face

    var body: some View {
        let dots = face.dots
        if !face.detail.isEmpty || dots.total > 0 {
            HStack(spacing: 8) {
                Text(face.detail)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                SetDots(done: dots.done, total: dots.total)
            }
        }
    }
}

/// One small hexagon per set: done in honey, the next one lighter, the rest
/// faint. Past eight, "3/10" in their place.
private struct SetDots: View {
    let done: Int
    let total: Int

    private static let most = 8

    var body: some View {
        if total > Self.most {
            Text("\(min(done + 1, total))/\(total)")
                .font(.system(size: 11.5, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Palette.muted)
        } else if total > 0 {
            HStack(spacing: 3) {
                ForEach(0..<total, id: \.self) { index in
                    LogoHexagon()
                        .fill(color(index))
                        .frame(width: 9, height: 10)
                }
            }
        }
    }

    private func color(_ index: Int) -> Color {
        if index < done {
            return Palette.honey
        }
        if index == done {
            return Palette.honeyLight
        }
        return Palette.chip
    }
}

/// Every state has its buttons, at most three (two in the Dynamic Island),
/// the main one in honey. Resting: −15, +15, Skip. Rest over: Start set,
/// +30 s and ✓ the next set as planned. Between sets: ✓, Other value (the
/// app, on that set) and Skip set. Paused: Continue; Finish stays in the
/// app. Buttons need iOS 17; before that, a tap on the activity opens the app.
private struct Actions: View {
    let face: Face
    /// How many the layout has room for; the least needed go first.
    let limit: Int

    var body: some View {
        if #available(iOS 17.0, *) {
            switch face.phase {
            case .rest:
                HStack(spacing: 6) {
                    if limit >= 3 {
                        Button(intent: ShortenRestIntent()) { Chip(text: "−15", stretch: true) }
                            .buttonStyle(.plain)
                    }
                    Button(intent: ExtendRestIntent()) { Chip(text: "+15", stretch: true) }
                        .buttonStyle(.plain)
                    Button(intent: SkipRestIntent()) { Chip(text: face.state.labels.skip, stretch: true) }
                        .buttonStyle(.plain)
                }
            case .go:
                HStack(spacing: 6) {
                    Button(intent: StartSetIntent()) {
                        Chip(text: face.state.labels.startSet, primary: true, stretch: true)
                    }
                    .buttonStyle(.plain)
                    if let more = shown(face.state.labels.more), showsMore {
                        Button(intent: MoreRestIntent()) { Chip(text: more) }
                            .buttonStyle(.plain)
                    }
                    if let step = face.step, face.canLog {
                        Button(intent: LogSetIntent(setId: step.setId)) { Chip(text: face.logLabel, whole: true) }
                            .buttonStyle(.plain)
                    }
                }
            case .workout:
                if let step = face.step {
                    HStack(spacing: 6) {
                        if face.canLog {
                            Button(intent: LogSetIntent(setId: step.setId)) {
                                Chip(text: face.logLabel, primary: true, whole: true)
                            }
                            .buttonStyle(.plain)
                        }
                        if let url = face.otherValueURL, let text = shown(openText) {
                            Link(destination: url) { Chip(text: text, primary: !face.canLog, stretch: true) }
                        }
                        if limit >= 3, let text = shown(face.state.labels.skipSet) {
                            Button(intent: SkipSetIntent(setId: step.setId)) { Chip(text: text, stretch: true) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            case .paused:
                if let text = shown(face.state.labels.resume) {
                    Button(intent: ResumeWorkoutIntent()) { Chip(text: text, primary: true, stretch: true) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    /// "+30 s" gives way to ✓ where only two fit.
    private var showsMore: Bool {
        limit >= 3 || !face.canLog
    }

    /// "Other value" on the lock screen; "Open" where there is less room.
    private var openText: String? {
        if limit >= 3 {
            return face.state.labels.otherValue
        }
        return face.state.labels.open
    }

    /// A label the app sent; nil when it sent none (an older app), so no blank button.
    private func shown(_ text: String?) -> String? {
        guard let text, !text.isEmpty else { return nil }
        return text
    }
}

private struct Chip: View {
    let text: String
    var primary = false
    /// Shares the row's width with the other buttons.
    var stretch = false
    /// Never shortened, as the weight on ✓: the others give way to it.
    var whole = false

    var body: some View {
        if whole {
            label.fixedSize().layoutPriority(1)
        } else {
            label
        }
    }

    private var label: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .foregroundStyle(ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .frame(maxWidth: width)
            .background(
                RoundedRectangle(cornerRadius: 11, style: .continuous).fill(fill)
            )
    }

    private var ink: Color {
        if primary {
            return Palette.ink
        }
        return .white
    }

    private var fill: Color {
        if primary {
            return Palette.honey
        }
        return Palette.chip
    }

    private var width: CGFloat? {
        if stretch {
            return .infinity
        }
        return nil
    }
}

// MARK: - Dynamic Island

/// Beside the camera: narrow, so the timer is held to a width it fits.
private struct CompactClock: View {
    let face: Face

    var body: some View {
        Group {
            switch face.phase {
            case let .rest(range):
                Text(timerInterval: range, countsDown: true)
                    .monospacedDigit()
                    .foregroundStyle(Palette.honey)
            case .go:
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Palette.goText)
            case let .workout(from):
                Text(from, style: .timer)
                    .monospacedDigit()
                    .foregroundStyle(.white)
            case let .paused(seconds):
                Text(clockText(seconds))
                    .monospacedDigit()
                    .foregroundStyle(Palette.muted)
            }
        }
        .font(.system(size: 15, weight: .semibold, design: .rounded))
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 52, alignment: .trailing)
    }
}

// MARK: - The hexagon

/// The logo's hexagon as a status: honey while resting, green with a tick
/// once the rest is over, an outline between sets, grey with a pause sign
/// while paused. Static: the countdown and the bar carry the time.
private struct TimerHex: View {
    let phase: Phase
    /// Point to point.
    let size: CGFloat

    private var width: CGFloat { size * LogoHexagon.ratio }

    var body: some View {
        ZStack {
            switch phase {
            case .rest:
                LogoHexagon().fill(Palette.honey)
            case .go:
                LogoHexagon().fill(Palette.go)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.38, weight: .heavy))
                    .foregroundStyle(.white)
            case .workout:
                LogoHexagon().strokeBorder(Palette.honey, lineWidth: max(1.5, size * 0.07))
            case .paused:
                LogoHexagon().fill(Palette.chip)
                Image(systemName: "pause.fill")
                    .font(.system(size: size * 0.32, weight: .bold))
                    .foregroundStyle(.white)
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
