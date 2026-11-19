import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

/// The lock screen and Dynamic Island face of the workout in progress, in the
/// Hex meter design (owner, 2026-11-19): the app's classic hexagon standing on
/// a point is the rest clock. A honey ring over a pale track while a rest
/// runs, a filled green hexagon with a tick once it is over, a plain outline
/// between sets, dashed while paused, a full green ring once every set is
/// logged. The system draws every timer from the dates in the state, so the
/// time stays right with the app asleep; the ring is drawn as the rest stood
/// when the activity was last drawn (a Live Activity cannot animate a shape),
/// so the time inside it is what counts.
///
@main
struct RestTimerBundle: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivity()
    }
}

private extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: opacity
        )
    }

    /// A colour that follows the phone's light or dark appearance.
    static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }
}

private extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: alpha
        )
    }
}

/// The app's colours (`variables.css`), fixed ones and the theme's pairs.
private enum Palette {
    /// The honey, `--ion-color-primary`: the ring draining and the main button.
    static let honey = Color(hex: 0xf59e0b)
    /// Text on honey, as on the app's honey buttons.
    static let onHoney = Color.black
    /// Rest over: the success green's 600 step, so the white tick clears 3:1.
    static let go = Color(hex: 0x059669)
}

/// The inks a surface reads: the lock screen follows the phone's theme, the
/// Dynamic Island is the system's black in both.
private struct Ink {
    let card: Color
    let text: Color
    let muted: Color
    /// The soft fill behind the quiet buttons, `--mh-color-divider`.
    let chip: Color
    /// The ring still to drain, `--mh-color-meter-track`.
    let track: Color
    /// Green as text, `--mh-color-success-deep`.
    let ok: Color

    static let lock = Ink(
        card: .adaptive(light: .white, dark: UIColor(hex: 0x2c2c2e)),
        text: .adaptive(light: UIColor(hex: 0x0e1b31), dark: UIColor(hex: 0xf0f4f8)),
        muted: .adaptive(light: UIColor(hex: 0x64748b), dark: UIColor(hex: 0x94a3b8)),
        chip: .adaptive(light: UIColor(hex: 0xe2e8f0), dark: UIColor(hex: 0x3a3a3c)),
        track: .adaptive(light: UIColor(hex: 0xfde68a), dark: UIColor(hex: 0xf59e0b, alpha: 0.3)),
        ok: .adaptive(light: UIColor(hex: 0x047857), dark: UIColor(hex: 0x34d399))
    )

    static let island = Ink(
        card: .black,
        text: .white,
        muted: Color(hex: 0x94a3b8),
        chip: Color(hex: 0x2c2c2e),
        track: Color(hex: 0xf59e0b, opacity: 0.3),
        ok: Color(hex: 0x34d399)
    )
}

/// Which face to show, worked out from the dates when the system draws it.
/// The rest turns to "Rest over" when its end passes (the state's stale date).
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
            .activityBackgroundTint(Ink.lock.card)
            .activitySystemActionForegroundColor(Ink.lock.text)
        } dynamicIsland: { context in
            let face = Face(
                state: context.state,
                phase: Phase(context.state, stale: context.isStale),
                logId: context.attributes.logId
            )
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HexMeter(face: face, size: 40, ink: .island) { MeterGlyph(face: face, size: 40, ink: .island) }
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    IslandTrail(face: face).padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        if face.showsNextLine {
                            NextLine(face: face, ink: .island)
                        }
                        Actions(face: face, limit: 2, ink: .island)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                HexMeter(face: face, size: 20, ink: .island) { EmptyView() }.padding(.leading, 2)
            } compactTrailing: {
                CompactClock(face: face)
            } minimal: {
                HexMeter(face: face, size: 20, ink: .island) { EmptyView() }
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

    /// The small line above the big number, in sentence case as every kicker
    /// in the app is: the look comes from its weight and tracking.
    var kicker: String {
        switch phase {
        case .rest:
            let superset = text(state.kicker)
            if !superset.isEmpty {
                return superset
            }
            return orFallback(state.labels.rest, "Rest")
        case .go:
            return orFallback(state.labels.restOver, "Rest over")
        case .workout:
            return joined([state.title, text(state.labels.workout)])
        case .paused:
            return joined([state.title, state.labels.paused])
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

    /// "Log set": the tick before it is drawn, not written.
    var logLabel: String { orFallback(state.labels.logSet, "Log set") }
    var editLabel: String { orFallback(state.labels.editSet, orFallback(state.labels.otherValue, "Edit set")) }
    var finishLabel: String { orFallback(state.labels.finishWorkout, "Finish workout") }
    var openLabel: String { orFallback(state.labels.open, "Open") }
    var plusLabel: String { orFallback(state.labels.more, "+15 s") }
    var minusLabel: String { plusLabel.replacingOccurrences(of: "+", with: "−") }

    /// The app, opened on the workout: Open.
    var workoutURL: URL? {
        var link = URLComponents()
        link.scheme = "motionhive"
        link.host = "log"
        link.path = "/\(logId)"
        return link.url
    }

    /// The app, opened on the workout to finish it there: Finish workout.
    var finishURL: URL? {
        var link = URLComponents()
        link.scheme = "motionhive"
        link.host = "log"
        link.path = "/\(logId)"
        link.queryItems = [URLQueryItem(name: "finish", value: "1")]
        return link.url
    }

    /// Every set is logged, as the app counts them (or a ✓ here ticked the
    /// last one). Never read off an empty `steps`: an empty workout, or one
    /// the app has not counted, sends that too.
    var allDone: Bool {
        if case .workout = phase {
            return state.allDone ?? false
        }
        return false
    }

    /// Under the time in the large ring: "of 1:30", "Workout", "Paused".
    var caption: String {
        switch phase {
        case .rest: return text(state.planned)
        case .paused: return state.labels.paused
        default: return orFallback(state.labels.workout, "Workout")
        }
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

/// The large ring on the left with the time inside it, the kicker, the next
/// set and its target beside it, and the buttons on a full-width row below,
/// the honey one last. Fixed type sizes, so its height is known whatever the
/// person's text size: about 150 points, under the 160 the lock screen allows.
private struct RichView: View {
    let face: Face
    private let ink = Ink.lock

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 14) {
                HexMeter(face: face, size: 72, ink: ink) { RingTime(face: face, ink: ink) }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(face.allDone ? face.state.labels.allDone ?? face.kicker : face.kicker)
                            .font(.system(size: 12, weight: .semibold))
                            .tracking(0.96)
                            .foregroundStyle(kickerInk)
                            .lineLimit(1)
                        if case let .go(since) = face.phase {
                            Overtime(since: since, ink: ink)
                        }
                    }
                    if face.showsNextLine {
                        NextLine(face: face, ink: ink)
                    }
                    if !face.lockDetail.isEmpty {
                        Text(face.lockDetail)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(ink.muted)
                            .lineLimit(1)
                    }
                    if !face.allDone {
                        SetDots(done: face.dots.done, total: face.dots.total, ink: ink)
                            .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Actions(face: face, limit: 3, ink: ink)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var kickerInk: Color {
        if face.allDone { return ink.ok }
        if case .go = face.phase { return ink.ok }
        return ink.muted
    }
}

/// "+0:25", counting up from the rest's end, in the muted ink: overtime is
/// not a mistake, so never red, and not a success either, so never green.
private struct Overtime: View {
    let since: Date
    let ink: Ink

    var body: some View {
        (Text("+") + Text(since, style: .timer))
            .font(.system(size: 15, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(ink.muted)
            .lineLimit(1)
            .frame(maxWidth: 64, alignment: .leading)
    }
}

/// Inside the large ring while a clock counts: the time at 20, and under it
/// "of 1:30", "Workout" or "Paused" at 11. A status (rest over, all done)
/// shows its glyph instead.
private struct RingTime: View {
    let face: Face
    let ink: Ink

    var body: some View {
        switch face.phase {
        case .go:
            EmptyView()
        default:
            if face.allDone {
                MeterGlyph(face: face, size: 72, ink: ink)
            } else {
                VStack(spacing: 1) {
                    BigTime(face: face, ink: ink, size: 20)
                        .frame(width: 52)
                    Text(face.caption)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(ink.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(width: 52)
                }
            }
        }
    }
}

/// The time as the system counts it: the rest down, the workout up, a paused one standing still.
private struct BigTime: View {
    let face: Face
    let ink: Ink
    let size: CGFloat

    var body: some View {
        Group {
            switch face.phase {
            case let .rest(range):
                Text(timerInterval: range, countsDown: true)
                    .foregroundStyle(ink.text)
            case let .workout(from):
                Text(from, style: .timer)
                    .foregroundStyle(ink.text)
            case let .paused(seconds):
                Text(clockText(seconds))
                    .foregroundStyle(ink.muted)
            case .go:
                Text("")
            }
        }
        .font(.system(size: size, weight: .bold))
        .monospacedDigit()
        .multilineTextAlignment(.center)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

/// "Next: Bench press · Set 2": the name gives way first, the set never. In a
/// superset, the whole round in order. The weight is on the line under it,
/// in the muted ink: honey is kept for actions.
private struct NextLine: View {
    let face: Face
    let ink: Ink

    private var prefix: String {
        switch face.phase {
        case .rest, .go: return "\(face.nextLabel): "
        default: return ""
        }
    }

    var body: some View {
        Group {
            if !face.hasPieces || face.isPausedOnly {
                Text(face.oneLine)
                    .foregroundStyle(ink.muted)
                    .lineLimit(1)
            } else if face.isSuperset {
                Text(prefix + face.order)
                    .lineLimit(1)
            } else {
                HStack(spacing: 0) {
                    Text(prefix + face.exercise).lineLimit(1)
                    if !face.setName.isEmpty {
                        Text(" · \(face.setName)").lineLimit(1).fixedSize()
                    }
                }
            }
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(ink.text)
    }
}

private extension Face {
    /// A paused workout with nothing known to come still says so.
    var isPausedOnly: Bool {
        if case .paused = phase {
            return !hasPieces
        }
        return false
    }

    /// Under the next set: the target and last time, whatever the face.
    var lockDetail: String {
        if !hasPieces || isSuperset {
            return detail
        }
        switch phase {
        case .rest, .go:
            return [target, detail].filter { !$0.isEmpty }.joined(separator: " · ")
        default:
            return detail
        }
    }
}

/// One small hexagon per set: done filled, the next one a thick outline, the
/// rest a thin grey one. Past eight, "3/10" in their place.
private struct SetDots: View {
    let done: Int
    let total: Int
    let ink: Ink

    private static let most = 8

    var body: some View {
        if total > Self.most {
            Text("\(min(done + 1, total))/\(total)")
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(ink.muted)
        } else if total > 0 {
            HStack(spacing: 4) {
                ForEach(0..<total, id: \.self) { index in
                    dot(index).frame(width: 10, height: 10)
                }
            }
        }
    }

    @ViewBuilder
    private func dot(_ index: Int) -> some View {
        if index < done {
            ClassicHexagon().fill(ink.text)
        } else if index == done {
            ClassicHexagon().stroke(ink.text, lineWidth: 1.6)
        } else {
            ClassicHexagon().stroke(ink.muted, lineWidth: 0.8)
        }
    }
}

/// Every state has its buttons, at most three (two in the Dynamic Island),
/// the main one in honey and last, on the right. Resting: −15 s, +15 s, Skip.
/// Rest over: +15 s, ✓ Log set, Start set. Between sets: Edit set (the app,
/// on that set; Open in the island), ✓ Log set. All sets done: Open, Finish
/// workout (both the app, on the workout). Paused: Continue. Buttons need
/// iOS 17; before that, a tap on the activity opens the app.
private struct Actions: View {
    let face: Face
    /// How many the layout has room for; the least needed go first.
    let limit: Int
    let ink: Ink

    var body: some View {
        if #available(iOS 17.0, *) {
            HStack(spacing: 8) {
                switch face.phase {
                case .rest:
                    if limit >= 3 {
                        Button(intent: ShortenRestIntent()) { chip(face.minusLabel) }.buttonStyle(.plain)
                    }
                    Button(intent: ExtendRestIntent()) { chip(face.plusLabel) }.buttonStyle(.plain)
                    Button(intent: SkipRestIntent()) { chip(face.state.labels.skip) }.buttonStyle(.plain)
                case .go:
                    if limit >= 3 || !face.canLog {
                        Button(intent: MoreRestIntent()) { chip(face.plusLabel) }.buttonStyle(.plain)
                    }
                    if let step = face.step, face.canLog {
                        Button(intent: LogSetIntent(setId: step.setId)) { chip(face.logLabel, tick: true) }
                            .buttonStyle(.plain)
                    }
                    Button(intent: StartSetIntent()) { chip(face.state.labels.startSet, primary: true) }
                        .buttonStyle(.plain)
                case .workout:
                    if let step = face.step {
                        if face.canLog {
                            if limit >= 3, let url = face.otherValueURL {
                                Link(destination: url) { chip(face.editLabel) }
                            } else if let url = face.workoutURL {
                                Link(destination: url) { chip(face.openLabel) }
                            }
                            Button(intent: LogSetIntent(setId: step.setId)) {
                                chip(face.logLabel, primary: true, tick: true)
                            }
                            .buttonStyle(.plain)
                        } else if let url = face.otherValueURL {
                            Link(destination: url) { chip(face.openLabel, primary: true) }
                        }
                    } else if face.allDone, let url = face.workoutURL, let finish = face.finishURL {
                        Link(destination: url) { chip(face.openLabel) }
                        Link(destination: finish) { chip(face.finishLabel, primary: true) }
                    }
                case .paused:
                    if let text = face.state.labels.resume, !text.isEmpty {
                        Button(intent: ResumeWorkoutIntent()) { chip(text, primary: true) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func chip(_ text: String, primary: Bool = false, tick: Bool = false) -> some View {
        Chip(text: text, primary: primary, tick: tick, ink: ink)
    }
}

/// One button: the honey one for the main action, the soft fill for the rest,
/// sharing the row's width.
private struct Chip: View {
    let text: String
    var primary = false
    /// A tick before the text: Log set.
    var tick = false
    let ink: Ink

    var body: some View {
        HStack(spacing: 5) {
            if tick {
                Image(systemName: "checkmark").font(.system(size: 12, weight: .bold))
            }
            Text(text)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(primary ? Palette.onHoney : ink.text)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, minHeight: 36)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(primary ? Palette.honey : ink.chip)
        )
    }
}

// MARK: - Dynamic Island

/// On the right of the expanded island: the time at 20 with what it is under
/// it; rest over is said in green, with the overtime beside it.
private struct IslandTrail: View {
    let face: Face
    private let ink = Ink.island

    var body: some View {
        VStack(alignment: .trailing, spacing: 3) {
            switch face.phase {
            case let .go(since):
                Text(face.kicker)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ink.ok)
                    .lineLimit(1)
                Overtime(since: since, ink: ink)
                    .multilineTextAlignment(.trailing)
            default:
                BigTime(face: face, ink: ink, size: 20)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 88, alignment: .trailing)
                Text(face.allDone ? face.state.labels.allDone ?? face.aside : islandCaption)
                    .font(.system(size: 12, weight: face.allDone ? .semibold : .medium))
                    .foregroundStyle(face.allDone ? ink.ok : ink.muted)
                    .lineLimit(1)
            }
        }
    }

    private var islandCaption: String {
        if case .paused = face.phase {
            return face.state.labels.paused
        }
        return face.aside
    }
}

/// Beside the camera: narrow, so the timer is held to a width it fits.
private struct CompactClock: View {
    let face: Face

    var body: some View {
        Group {
            switch face.phase {
            case let .rest(range):
                Text(timerInterval: range, countsDown: true)
                    .monospacedDigit()
                    .foregroundStyle(Ink.island.text)
            case .go:
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Ink.island.ok)
            case let .workout(from):
                Text(from, style: .timer)
                    .monospacedDigit()
                    .foregroundStyle(Ink.island.text)
            case let .paused(seconds):
                Text(clockText(seconds))
                    .monospacedDigit()
                    .foregroundStyle(Ink.island.muted)
            }
        }
        .font(.system(size: 15, weight: .semibold))
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 52, alignment: .trailing)
    }
}

// MARK: - The hex meter

/// The glyph in a ring with no time in it: a timer while resting, a barbell
/// between sets, a pause sign, a trophy once all is done (rest over draws its tick).
private struct MeterGlyph: View {
    let face: Face
    /// The ring's size; the glyph is about two fifths of it.
    let size: CGFloat
    let ink: Ink

    var body: some View {
        switch face.phase {
        case .go:
            EmptyView()
        case .rest:
            glyph("timer", ink.text)
        case .paused:
            glyph("pause", ink.muted)
        case .workout:
            if face.allDone {
                glyph("trophy", ink.ok)
            } else {
                glyph("dumbbell", ink.text)
            }
        }
    }

    private func glyph(_ name: String, _ color: Color) -> some View {
        Image(systemName: name)
            .font(.system(size: size * 0.4, weight: .semibold))
            .foregroundStyle(color)
    }
}

/// The ring, `hex-meter` in the app. While resting, the honey left is drawn
/// as the rest stood when the system drew the activity: it moves with each
/// update (a button, the app), and the time inside it counts every second.
private struct HexMeter<Inner: View>: View {
    let face: Face
    /// The square it is drawn in; the hexagon is 92% of it, point to point.
    let size: CGFloat
    let ink: Ink
    @ViewBuilder let inner: () -> Inner

    /// The stroke, as the app's: thicker on the small ones, where a thin line would vanish.
    private var line: CGFloat {
        let rate: CGFloat = size < 28 ? 0.11 : (size < 56 ? 0.09 : 0.06)
        return max(1.5, size * rate)
    }

    var body: some View {
        ZStack {
            switch face.phase {
            case let .rest(range):
                ClassicHexagon()
                    .stroke(ink.track, style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round))
                ClassicHexagon()
                    .trim(from: 0, to: left(range))
                    .stroke(Palette.honey, style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round))
            case .go:
                ClassicHexagon().fill(Palette.go)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.36, weight: .bold))
                    .foregroundStyle(.white)
            case .workout:
                if face.allDone {
                    ClassicHexagon()
                        .stroke(ink.ok, style: StrokeStyle(lineWidth: line, lineJoin: .round))
                } else {
                    ClassicHexagon()
                        .stroke(ink.text, style: StrokeStyle(lineWidth: line * 0.6, lineJoin: .round))
                }
            case .paused:
                ClassicHexagon()
                    .stroke(
                        ink.muted,
                        style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round, dash: [size * 0.04, size * 0.05])
                    )
            }
            inner()
        }
        .frame(width: size, height: size)
    }

    /// The rest still to go, as a share of the planned, at the moment it is drawn.
    private func left(_ range: ClosedRange<Date>) -> CGFloat {
        let total = range.upperBound.timeIntervalSince(range.lowerBound)
        guard total > 0 else { return 0 }
        let remaining = range.upperBound.timeIntervalSince(Date())
        return CGFloat(min(1, max(0, remaining / total)))
    }
}

/// The app's classic hexagon standing on a point (√3 : 2, its corners cut
/// back 11 on a 100 point to point size and joined by a curve through the
/// vertex): `hexPath` in `hexagon.config.ts`. Drawn 92% of the square's
/// height, so a ring's stroke has room at the points, and starting at the top
/// point, clockwise, so a trimmed ring drains from there.
private struct ClassicHexagon: Shape {
    private static let ratio: CGFloat = sqrt(3) / 2
    private static let cut: CGFloat = 11 / (50 * sqrt(3))
    private static let drawn: CGFloat = 0.92

    func path(in rect: CGRect) -> Path {
        let h = min(rect.height, rect.width / Self.ratio) * Self.drawn
        let w = h * Self.ratio
        let x0 = rect.midX - w / 2
        let y0 = rect.midY - h / 2
        let vertices = [
            CGPoint(x: w / 2, y: 0), CGPoint(x: w, y: h / 4), CGPoint(x: w, y: 3 * h / 4),
            CGPoint(x: w / 2, y: h), CGPoint(x: 0, y: 3 * h / 4), CGPoint(x: 0, y: h / 4),
        ].map { CGPoint(x: $0.x + x0, y: $0.y + y0) }
        let length = Self.cut * w
        func toward(_ from: CGPoint, _ to: CGPoint) -> CGPoint {
            let t = length / hypot(to.x - from.x, to.y - from.y)
            return CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        }
        func mid(_ a: CGPoint, _ b: CGPoint) -> CGPoint {
            CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
        }
        let corners = vertices.indices.map { index in
            (enter: toward(vertices[index], vertices[(index + 5) % 6]),
             vertex: vertices[index],
             leave: toward(vertices[index], vertices[(index + 1) % 6]))
        }
        // The top corner's curve split in half: start at its apex.
        let top = corners[0]
        let apex = CGPoint(
            x: (top.enter.x + 2 * top.vertex.x + top.leave.x) / 4,
            y: (top.enter.y + 2 * top.vertex.y + top.leave.y) / 4
        )
        var path = Path()
        path.move(to: apex)
        path.addQuadCurve(to: top.leave, control: mid(top.vertex, top.leave))
        for corner in corners.dropFirst() {
            path.addLine(to: corner.enter)
            path.addQuadCurve(to: corner.leave, control: corner.vertex)
        }
        path.addLine(to: top.enter)
        path.addQuadCurve(to: apex, control: mid(top.enter, top.vertex))
        path.closeSubpath()
        return path
    }
}
