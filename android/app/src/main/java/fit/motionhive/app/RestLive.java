package fit.motionhive.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

/**
 * The workout in progress as an ongoing notification (Workouts R2, Active
 * Workout, "Outside the app"), in the Hex meter design (owner, 2026-11-19):
 * folded, one line with the rest's bar; unfolded, a card with the app's
 * hexagon ring and the time inside it, the kicker, the next set and its
 * target. The rest counts down with −15 s, +15 s and Skip; once it is over,
 * +15 s, Log set and Start set; between sets, Edit set and Log set; once
 * every set is logged, Open and Finish workout. The main button is always
 * last. The countdown and the clock are the system's Chronometer, so they
 * keep time with the app asleep; the ring and the bar move once a second
 * while the process lives.
 *
 * The state comes from the web side through {@link RestLivePlugin} and is
 * kept in preferences, so the buttons still work after the process died.
 * What they do is noted for the web side, which takes the notes when it runs
 * again and records the rest as if the bar had been tapped.
 *
 * At the rest's end this notification turns to Go and sounds itself, from an
 * exact alarm, so there is no second "Rest over" notification beside it: the
 * web side does not schedule one on Android while this one shows. Swiped
 * away, it stays away, and the rest's end posts a plain "Rest over" instead.
 * Silent while the app is on screen, where the rest bar says it.
 */
final class RestLive {

    static final String CHANNEL_ID = "workout_live";
    /** Clear of the ids the web side gives Capacitor's local notifications (1, 2). */
    static final int NOTIFICATION_ID = 7301;

    static final String ACTION_EXTEND = "fit.motionhive.app.rest.EXTEND";
    static final String ACTION_SHORTEN = "fit.motionhive.app.rest.SHORTEN";
    /** +15 s once the rest is over: a little more, counted from now. */
    static final String ACTION_MORE = "fit.motionhive.app.rest.MORE";
    /** ✓ the next set as planned. */
    static final String ACTION_LOG = "fit.motionhive.app.rest.LOG";
    static final String ACTION_SKIP = "fit.motionhive.app.rest.SKIP";
    static final String ACTION_START = "fit.motionhive.app.rest.START";
    static final String ACTION_DISMISSED = "fit.motionhive.app.rest.DISMISSED";
    /** The rest's end: Go is drawn, and sounds. */
    static final String ACTION_GO = "fit.motionhive.app.rest.GO";

    /** The same nudge as the rest bar's (NUDGE_SECONDS). */
    private static final long NUDGE_MS = 15_000;
    /** Ten minutes over and it is no longer rest (OVERTIME_CEILING_SECONDS). */
    private static final long OVERTIME_CEILING_MS = 10 * 60_000;
    /** Never left behind: gone after 8 hours without news, as iOS ends a Live Activity. */
    private static final long TIMEOUT_MS = 8 * 60 * 60_000;

    /**
     * The id RestAlertService gives the rest-over alert (REST_NOTIFICATION_ID).
     * A swiped-away workout's "Rest over" is posted here under the same id,
     * so either side can take it down, and a rest ended from here takes down
     * whichever is showing.
     */
    private static final int REST_ALERT_ID = 1;
    /** The channel that sounds: Go, and the plain "Rest over". */
    static final String ALERT_CHANNEL_ID = "workout_rest_over";
    /** Go sounds only while it is news: within a minute of the rest's end. */
    private static final long ALERT_WINDOW_MS = 60_000;

    private static final String PREFS = "mh_rest_live";
    private static final String KEY_STATE = "state";
    private static final String KEY_ACTIONS = "actions";
    /** The workout whose notification was swiped away: it stays away for that workout. */
    private static final String KEY_DISMISSED = "dismissed";
    /** The rest's end Go was last drawn for, so it sounds once a rest at most. */
    private static final String KEY_ALERTED = "alerted";

    private enum Phase { REST, GO, WORKOUT, PAUSED }

    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static Runnable tick;
    /** Set while the plugin is loaded: tells the web side there are notes to take. */
    static Runnable listener;
    /** True while the app is on screen: its own rest bar says Go, so this stays silent. */
    static volatile boolean inFront;
    /** When the Go alarm is set for, so a render each second does not set it again. */
    private static long goAt;

    private RestLive() {}

    // ─── From the web side ─────────────────────────────────────────

    static synchronized void show(Context context, JSONObject next) {
        JSONObject current = load(context);
        String logId = next.optString("logId");
        boolean sameWorkout = current != null && logId.equals(current.optString("logId"));
        if (sameWorkout && pending(context).length() > 0) {
            // A button changed the rest and the web side has not taken the
            // note yet: until it does, the rest here is the true one.
            copy(current, next, "restStartedAt");
            copy(current, next, "restEndsAt");
        }
        SharedPreferences.Editor editor = prefs(context).edit().putString(KEY_STATE, next.toString());
        if (!sameWorkout) editor.remove(KEY_DISMISSED);
        editor.apply();
        render(context);
    }

    static synchronized void end(Context context) {
        stopTicking();
        cancelGo(context);
        prefs(context).edit().remove(KEY_STATE).remove(KEY_DISMISSED).remove(KEY_ALERTED).apply();
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }

    /** The notes, oldest first, handed over once. */
    static synchronized JSONArray take(Context context) {
        JSONArray actions = pending(context);
        prefs(context).edit().remove(KEY_ACTIONS).apply();
        return actions;
    }

    // ─── From the buttons ──────────────────────────────────────────

    /** +15 s: the rest ends 15 seconds later, never before now. */
    static synchronized void extend(Context context) {
        JSONObject state = load(context);
        long end = state == null ? 0 : state.optLong("restEndsAt", 0);
        if (end <= 0) return;
        long now = System.currentTimeMillis();
        long endsAt = Math.max(now, end + NUDGE_MS);
        put(state, "restEndsAt", endsAt);
        save(context, state);
        JSONObject action = action("extend", now);
        put(action, "endsAt", endsAt);
        record(context, action);
        render(context);
    }

    /** −15 s: the rest ends 15 seconds sooner; at or past now, it is over, as Skip. */
    static synchronized void shorten(Context context) {
        JSONObject state = load(context);
        long end = state == null ? 0 : state.optLong("restEndsAt", 0);
        if (end <= 0) return;
        long now = System.currentTimeMillis();
        long endsAt = end - NUDGE_MS;
        if (endsAt <= now) {
            endRest(context, "skip");
            return;
        }
        put(state, "restEndsAt", endsAt);
        save(context, state);
        JSONObject action = action("extend", now);
        put(action, "endsAt", endsAt);
        record(context, action);
        render(context);
    }

    /** +15 s with the rest over: a little more, counted from now. */
    static synchronized void more(Context context) {
        JSONObject state = load(context);
        if (state == null || state.optLong("restEndsAt", 0) <= 0) return;
        long now = System.currentTimeMillis();
        long endsAt = now + NUDGE_MS;
        put(state, "restEndsAt", endsAt);
        save(context, state);
        JSONObject action = action("extend", now);
        put(action, "endsAt", endsAt);
        record(context, action);
        render(context);
    }

    /**
     * Log set: the next set is done as the card showed it. The set after it
     * shows at once, with its rest counting down; the web side saves the set
     * when it runs (the same note as the iOS Live Activity's ✓). `setId` is
     * the set the tapped button was drawn for: a second tap before the card
     * redraws carries the same one, which is no longer first, so it does
     * nothing instead of logging the set after it.
     */
    static synchronized void logSet(Context context, String setId) {
        JSONObject state = load(context);
        JSONArray steps = state == null ? null : state.optJSONArray("steps");
        JSONObject step = steps == null ? null : steps.optJSONObject(0);
        if (step == null) return;
        // A button from before the set id was sent carries none: as before.
        if (setId != null && !setId.equals(step.optString("setId"))) return;
        JSONObject values = step.optJSONObject("values");
        if (values == null || values.length() == 0) return;
        long now = System.currentTimeMillis();
        JSONArray ahead = new JSONArray();
        for (int index = 1; index < steps.length(); index++) ahead.put(steps.opt(index));
        put(state, "steps", ahead);
        showStep(state, ahead.optJSONObject(0));
        put(state, "restLine", "");
        put(state, "goLine", "");
        put(state, "workoutLine", ahead.length() == 0 && step.optBoolean("final")
                ? labelsOf(state).optString("allDone") : "");
        // The workout's last set ticked: Open and Finish workout, the green ring.
        put(state, "allDone", step.optBoolean("completes", false));
        int rest = step.optInt("rest", 0);
        long endsAt = 0;
        if (!step.isNull("rest") && rest > 0) {
            endsAt = now + rest * 1000L;
            put(state, "restStartedAt", now);
            put(state, "restEndsAt", endsAt);
        } else {
            state.remove("restStartedAt");
            state.remove("restEndsAt");
        }
        save(context, state);
        NotificationManagerCompat.from(context).cancel(REST_ALERT_ID);
        JSONObject action = action("log", now);
        put(action, "setId", step.optString("setId"));
        put(action, "exerciseId", step.optString("exerciseId"));
        put(action, "values", values);
        if (endsAt > 0) put(action, "endsAt", endsAt);
        record(context, action);
        render(context);
    }

    /** The pieces of the next set on top of the state, or none once nothing is left. */
    private static void showStep(JSONObject state, JSONObject step) {
        String[] keys = {"exercise", "set", "target", "aim", "last", "done", "total", "progress", "kicker", "order"};
        for (String key : keys) {
            if (step != null && step.has(key)) put(state, key, step.opt(key));
            else state.remove(key);
        }
        state.remove("planned");
    }

    private static JSONObject labelsOf(JSONObject state) {
        JSONObject labels = state.optJSONObject("labels");
        return labels == null ? new JSONObject() : labels;
    }

    /** Skip (before zero) or Start set (after): the rest ends now, and that is its length. */
    static synchronized void endRest(Context context, String type) {
        JSONObject state = load(context);
        if (state == null || state.optLong("restEndsAt", 0) <= 0) return;
        state.remove("restStartedAt");
        state.remove("restEndsAt");
        save(context, state);
        // A "Rest over" already showing is old news once the rest has ended.
        NotificationManagerCompat.from(context).cancel(REST_ALERT_ID);
        record(context, action(type, System.currentTimeMillis()));
        render(context);
    }

    /** The Go alarm, at the rest's end: drawn now, and sounding if it is news. */
    static synchronized void restOver(Context context) {
        goAt = 0;
        render(context);
    }

    /** Swiped away (Android 14 lets an ongoing notification go): not again for this workout. */
    static synchronized void dismissed(Context context) {
        stopTicking();
        JSONObject state = load(context);
        if (state != null) prefs(context).edit().putString(KEY_DISMISSED, state.optString("logId")).apply();
    }

    // ─── Drawing it ────────────────────────────────────────────────

    private static void render(Context context) {
        stopTicking();
        JSONObject state = load(context);
        if (state == null) return;

        long now = System.currentTimeMillis();
        long start = state.optLong("restStartedAt", 0);
        long end = state.optLong("restEndsAt", 0);
        long clockFrom = state.optLong("clockFrom", 0);
        Phase phase;
        if (end > 0 && now < end) phase = Phase.REST;
        else if (end > 0 && now < end + OVERTIME_CEILING_MS) phase = Phase.GO;
        else if (clockFrom > 0) phase = Phase.WORKOUT;
        else phase = Phase.PAUSED;

        // Go is due at the rest's end whether or not the process lives then.
        if (phase == Phase.REST) scheduleGo(context, end);
        else cancelGo(context);
        boolean alert = phase == Phase.GO && goIsNews(context, end, now);

        if (!canNotify(context)) return;
        JSONObject labels = state.optJSONObject("labels");
        if (labels == null) labels = new JSONObject();
        if (state.optString("logId").equals(prefs(context).getString(KEY_DISMISSED, null))) {
            // Swiped away, it stays away; the rest's end still deserves a sound.
            if (alert) postRestOver(context, labels, state.optString("goLine"));
            return;
        }
        ensureChannel(context, labels.optString("channel", "Workout"));
        if (alert) ensureAlertChannel(context, labels.optString("alertTitle", "Rest over"));

        String title = state.optString("title");
        String workoutLine = state.optString("workoutLine");
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.rest_live_notification);
        JSONArray steps = state.optJSONArray("steps");
        JSONObject step = steps == null ? null : steps.optJSONObject(0);
        JSONObject stepValues = step == null ? null : step.optJSONObject("values");
        boolean canLog = stepValues != null && stepValues.length() > 0;
        // As the app counts them, never read off an empty `steps`: an empty
        // workout, or one the app has not counted, sends that too.
        boolean allDone = phase == Phase.WORKOUT && state.optBoolean("allDone", false);
        String stepId = step == null ? null : step.optString("setId");
        RemoteViews card = card(context, state, labels, phase, now, start, end, clockFrom, allDone);
        String subText;
        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, alert ? ALERT_CHANNEL_ID : CHANNEL_ID);

        switch (phase) {
            case REST: {
                subText = labels.optString("rest");
                view.setViewVisibility(R.id.rest_live_title, View.GONE);
                countDown(view, end - now);
                line(view, workoutLine);
                long total = Math.max(1, end - Math.min(start > 0 ? start : end, end));
                view.setViewVisibility(R.id.rest_live_progress, View.VISIBLE);
                view.setProgressBar(R.id.rest_live_progress, 1000, (int) ((end - now) * 1000 / total), false);
                String plus = labels.optString("plus", "+15 s");
                builder.addAction(0, plus.replace("+", "\u2212"), broadcast(context, ACTION_SHORTEN));
                builder.addAction(0, plus, broadcast(context, ACTION_EXTEND));
                builder.addAction(0, labels.optString("skip"), broadcast(context, ACTION_SKIP));
                break;
            }
            case GO: {
                subText = labels.optString("restOver");
                title(view, labels.optString("restOver", labels.optString("go")));
                view.setViewVisibility(R.id.rest_live_clock, View.GONE);
                line(view, state.optString("goLine"));
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                builder.addAction(0, labels.optString("more", "+15 s"), broadcast(context, ACTION_MORE));
                if (canLog) builder.addAction(0, labels.optString("logSet", "Log set"), logBroadcast(context, stepId));
                builder.addAction(0, labels.optString("startSet"), broadcast(context, ACTION_START));
                break;
            }
            case WORKOUT: {
                subText = labels.optString("workout");
                title(view, title + " · ");
                countUp(view, now - clockFrom);
                line(view, workoutLine);
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                String logId = state.optString("logId");
                if (allDone) {
                    builder.addAction(0, labels.optString("open"), openApp(context));
                    builder.addAction(0, labels.optString("finishWorkout", "Finish workout"),
                            openLog(context, logId, null, true));
                } else if (canLog) {
                    builder.addAction(0, labels.optString("editSet", "Edit set"),
                            openLog(context, logId, stepId, false));
                    builder.addAction(0, labels.optString("logSet", "Log set"), logBroadcast(context, stepId));
                } else {
                    builder.addAction(0, labels.optString("open"), openApp(context));
                }
                break;
            }
            default: {
                subText = labels.optString("workout");
                title(view, title + " · " + clock(state.optInt("pausedSeconds", 0)));
                view.setViewVisibility(R.id.rest_live_clock, View.GONE);
                line(view, labels.optString("paused"));
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                builder.addAction(0, labels.optString("open"), openApp(context));
                break;
            }
        }

        builder.setSmallIcon(R.drawable.ic_stat_motionhive)
                .setColor(ContextCompat.getColor(context, R.color.mh_notification_accent))
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(view)
                .setCustomBigContentView(card)
                .setSubText(subText)
                .setOngoing(true)
                // Quiet on every redraw but the one Go that is news.
                .setOnlyAlertOnce(!alert)
                .setSilent(!alert)
                .setShowWhen(false)
                .setCategory(alert ? NotificationCompat.CATEGORY_REMINDER : NotificationCompat.CATEGORY_PROGRESS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setTimeoutAfter(TIMEOUT_MS)
                .setContentIntent(openApp(context))
                .setDeleteIntent(broadcast(context, ACTION_DISMISSED));
        if (alert) {
            // Android 7 has no channels: the sound and the peek come from these.
            builder.setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL);
        }
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException denied) {
            return;
        }

        // The bar moves each second; the faces change at zero and at the ceiling.
        long delay;
        if (phase == Phase.REST) delay = Math.min(1000, end - now);
        else if (phase == Phase.GO) delay = end + OVERTIME_CEILING_MS - now;
        else return;
        final Context app = context.getApplicationContext();
        tick = () -> {
            synchronized (RestLive.class) {
                render(app);
            }
        };
        HANDLER.postDelayed(tick, Math.max(50, delay));
    }

    // ─── The card, unfolded: the Hex meter ─────────────────────────

    /** The ring with the time inside it, and the kicker, the next set and its target beside it. */
    private static RemoteViews card(Context context, JSONObject state, JSONObject labels, Phase phase,
                                    long now, long start, long end, long clockFrom, boolean allDone) {
        RemoteViews card = new RemoteViews(context.getPackageName(), R.layout.rest_live_card);
        long total = Math.max(1, end - Math.min(start > 0 ? start : end, end));
        float left = phase == Phase.REST ? Math.max(0f, Math.min(1f, (end - now) / (float) total)) : 0f;
        setRing(context, card, phase, left, allDone);

        String title = state.optString("title");
        String kicker;
        boolean ok = false;
        String caption;
        card.setViewVisibility(R.id.rest_card_inner, View.VISIBLE);
        card.setViewVisibility(R.id.rest_card_over, View.GONE);
        switch (phase) {
            case REST:
                kicker = state.optString("kicker");
                if (kicker.isEmpty()) kicker = labels.optString("rest");
                caption = state.optString("planned");
                card.setChronometer(R.id.rest_card_clock, SystemClock.elapsedRealtime() + (end - now), null, true);
                card.setChronometerCountDown(R.id.rest_card_clock, true);
                break;
            case GO:
                kicker = labels.optString("restOver");
                ok = true;
                caption = "";
                // The tick is drawn on the ring; the overtime counts up beside the kicker.
                card.setViewVisibility(R.id.rest_card_inner, View.GONE);
                card.setViewVisibility(R.id.rest_card_over, View.VISIBLE);
                card.setChronometer(R.id.rest_card_over, SystemClock.elapsedRealtime() - (now - end), "+%s", true);
                card.setChronometerCountDown(R.id.rest_card_over, false);
                tint(context, card, R.id.rest_card_over, R.color.mh_meter_muted);
                break;
            case WORKOUT:
                kicker = allDone ? labels.optString("allDone") : joined(labels.optString("workout"), title);
                ok = allDone;
                caption = labels.optString("workout");
                card.setChronometer(R.id.rest_card_clock, SystemClock.elapsedRealtime() - (now - clockFrom), null, true);
                card.setChronometerCountDown(R.id.rest_card_clock, false);
                break;
            default:
                kicker = joined(labels.optString("paused"), title);
                caption = labels.optString("paused");
                int pausedSeconds = state.optInt("pausedSeconds", 0);
                // Stopped, then the time it stands at as text: a stopped
                // Chronometer draws "now − base" each time the system redraws
                // the card, so it would grow by the time since it was posted.
                card.setChronometer(R.id.rest_card_clock, SystemClock.elapsedRealtime() - pausedSeconds * 1000L, null, false);
                card.setTextViewText(R.id.rest_card_clock, clock(pausedSeconds));
                tint(context, card, R.id.rest_card_clock, R.color.mh_meter_muted);
                break;
        }
        card.setTextViewText(R.id.rest_card_kicker, kicker);
        tint(context, card, R.id.rest_card_kicker, ok ? R.color.mh_meter_ok : R.color.mh_meter_muted);
        card.setTextViewText(R.id.rest_card_caption, caption);
        tint(context, card, R.id.rest_card_caption, R.color.mh_meter_muted);

        // "Next: Bench press · Set 3", then the target and the last time.
        String exercise = state.optString("exercise");
        String order = state.optString("order");
        String next;
        String detail;
        boolean resting = phase == Phase.REST || phase == Phase.GO;
        if (exercise.isEmpty()) {
            next = phase == Phase.GO ? state.optString("goLine") : state.optString("workoutLine");
            detail = "";
        } else {
            String set = order.isEmpty() ? joined(exercise, state.optString("set")) : order;
            next = resting ? labels.optString("next", "Next") + ": " + set : set;
            detail = order.isEmpty()
                    ? (resting ? joined(state.optString("target"), state.optString("last"))
                               : joined(state.optString("aim"), state.optString("last")))
                    : "";
        }
        card.setTextViewText(R.id.rest_card_next, next);
        card.setViewVisibility(R.id.rest_card_next, next.isEmpty() ? View.GONE : View.VISIBLE);
        card.setTextViewText(R.id.rest_card_detail, detail);
        card.setViewVisibility(R.id.rest_card_detail, detail.isEmpty() ? View.GONE : View.VISIBLE);
        tint(context, card, R.id.rest_card_detail, R.color.mh_meter_muted);
        return card;
    }

    /**
     * A text colour that follows the phone's theme. From Android 12 the
     * resource itself goes in, resolved each time the system draws the card,
     * so a switch to dark or light while it shows recolours it with the app
     * asleep; before that, its value now.
     */
    private static void tint(Context context, RemoteViews view, int id, int color) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            view.setColorStateList(id, "setTextColor", color);
        } else {
            view.setTextColor(id, ContextCompat.getColor(context, color));
        }
    }

    /**
     * The ring, for the theme the system draws the card in: from Android 12
     * drawn once for light and once for dark, and the system shows the one
     * that fits, as `tint` does for the texts; before that, for the theme now.
     */
    private static void setRing(Context context, RemoteViews card, Phase phase, float left, boolean allDone) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Icon light = Icon.createWithBitmap(ring(themed(context, false), phase, left, allDone));
            Icon dark = Icon.createWithBitmap(ring(themed(context, true), phase, left, allDone));
            card.setIcon(R.id.rest_card_ring, "setImageIcon", light, dark);
        } else {
            card.setImageViewBitmap(R.id.rest_card_ring, ring(context, phase, left, allDone));
        }
    }

    /** `context` with the phone's theme set to dark or light, for the colours of one theme. */
    private static Context themed(Context context, boolean night) {
        Configuration config = new Configuration(context.getResources().getConfiguration());
        int mode = night ? Configuration.UI_MODE_NIGHT_YES : Configuration.UI_MODE_NIGHT_NO;
        config.uiMode = (config.uiMode & ~Configuration.UI_MODE_NIGHT_MASK) | mode;
        return context.createConfigurationContext(config);
    }

    private static String joined(String first, String second) {
        if (first == null || first.isEmpty()) return second == null ? "" : second;
        if (second == null || second.isEmpty()) return first;
        return first + " · " + second;
    }

    /**
     * The ring, `hex-meter` in the app: a honey ring draining over its pale
     * track while resting, a filled green hexagon with a tick once the rest is
     * over, a thin outline between sets (green once every set is logged),
     * dashed while paused. Drawn again each second while the rest runs.
     */
    private static Bitmap ring(Context context, Phase phase, float left, boolean allDone) {
        float density = context.getResources().getDisplayMetrics().density;
        int size = Math.round(72 * density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Path hex = hexPath(size);
        float line = Math.max(1.5f * density, size * 0.06f);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(line);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        switch (phase) {
            case REST: {
                paint.setColor(ContextCompat.getColor(context, R.color.mh_meter_track));
                canvas.drawPath(hex, paint);
                if (left > 0) {
                    PathMeasure measure = new PathMeasure(hex, false);
                    Path drained = new Path();
                    measure.getSegment(0, measure.getLength() * left, drained, true);
                    paint.setColor(ContextCompat.getColor(context, R.color.mh_honey));
                    canvas.drawPath(drained, paint);
                }
                break;
            }
            case GO: {
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(ContextCompat.getColor(context, R.color.mh_meter_go));
                canvas.drawPath(hex, paint);
                // The tick, two fifths of the ring, in white.
                Path tick = new Path();
                float unit = size * 0.36f / 24f;
                float x0 = size / 2f - 12 * unit;
                float y0 = size / 2f - 12 * unit;
                tick.moveTo(x0 + 5 * unit, y0 + 12.5f * unit);
                tick.lineTo(x0 + 9.5f * unit, y0 + 17 * unit);
                tick.lineTo(x0 + 19 * unit, y0 + 7.5f * unit);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(2.4f * unit);
                paint.setColor(0xffffffff);
                canvas.drawPath(tick, paint);
                break;
            }
            case WORKOUT: {
                paint.setColor(ContextCompat.getColor(context, allDone ? R.color.mh_meter_ok : R.color.mh_meter_ink));
                if (!allDone) paint.setStrokeWidth(line * 0.6f);
                canvas.drawPath(hex, paint);
                break;
            }
            default: {
                paint.setColor(ContextCompat.getColor(context, R.color.mh_meter_muted));
                paint.setPathEffect(new DashPathEffect(new float[] {size * 0.04f, size * 0.05f}, 0));
                canvas.drawPath(hex, paint);
                break;
            }
        }
        return bitmap;
    }

    /**
     * The app's classic hexagon standing on a point (√3 : 2, its corners cut
     * back 11 on a 100 point to point size, a curve through each vertex), as
     * `hexPath` in `hexagon.config.ts`: 92% of the square's height, so the
     * stroke has room, starting at the top point and going clockwise, so the
     * ring drains from there.
     */
    private static Path hexPath(int size) {
        float ratio = (float) (Math.sqrt(3) / 2);
        float h = size * 0.92f;
        float w = h * ratio;
        float x0 = (size - w) / 2f;
        float y0 = (size - h) / 2f;
        float[][] v = {
            {w / 2, 0}, {w, h / 4}, {w, 3 * h / 4}, {w / 2, h}, {0, 3 * h / 4}, {0, h / 4},
        };
        float cut = (float) (11 / (50 * Math.sqrt(3))) * w;
        float[][] enter = new float[6][];
        float[][] leave = new float[6][];
        for (int i = 0; i < 6; i++) {
            enter[i] = toward(v[i], v[(i + 5) % 6], cut);
            leave[i] = toward(v[i], v[(i + 1) % 6], cut);
        }
        // The top corner's curve split in half: start at its apex.
        float ax = (enter[0][0] + 2 * v[0][0] + leave[0][0]) / 4;
        float ay = (enter[0][1] + 2 * v[0][1] + leave[0][1]) / 4;
        Path path = new Path();
        path.moveTo(x0 + ax, y0 + ay);
        path.quadTo(x0 + (v[0][0] + leave[0][0]) / 2, y0 + (v[0][1] + leave[0][1]) / 2, x0 + leave[0][0], y0 + leave[0][1]);
        for (int i = 1; i < 6; i++) {
            path.lineTo(x0 + enter[i][0], y0 + enter[i][1]);
            path.quadTo(x0 + v[i][0], y0 + v[i][1], x0 + leave[i][0], y0 + leave[i][1]);
        }
        path.lineTo(x0 + enter[0][0], y0 + enter[0][1]);
        path.quadTo(x0 + (enter[0][0] + v[0][0]) / 2, y0 + (enter[0][1] + v[0][1]) / 2, x0 + ax, y0 + ay);
        path.close();
        return path;
    }

    private static float[] toward(float[] from, float[] to, float length) {
        float dx = to[0] - from[0];
        float dy = to[1] - from[1];
        float t = length / (float) Math.hypot(dx, dy);
        return new float[] {from[0] + dx * t, from[1] + dy * t};
    }

    /**
     * The app, opened on the workout: on a set for Edit set
     * (`motionhive://log/<id>?set=<setId>`), or to finish it there for Finish
     * workout (`motionhive://log/<id>?finish=1`). Sent to MainActivity by
     * name, since no intent filter claims the scheme on Android; Capacitor's
     * App plugin still reports it as `appUrlOpen`, which `AppLinkService` routes.
     */
    private static PendingIntent openLog(Context context, String logId, String setId, boolean finish) {
        if (logId == null || logId.isEmpty()) return openApp(context);
        Uri.Builder uri = new Uri.Builder().scheme("motionhive").authority("log").appendPath(logId);
        if (finish) uri.appendQueryParameter("finish", "1");
        else if (setId != null && !setId.isEmpty()) uri.appendQueryParameter("set", setId);
        Intent intent = new Intent(Intent.ACTION_VIEW, uri.build(), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int code = (finish ? "finish" : "edit").hashCode();
        return PendingIntent.getActivity(
                context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void countDown(RemoteViews view, long leftMs) {
        view.setViewVisibility(R.id.rest_live_clock, View.VISIBLE);
        view.setChronometer(R.id.rest_live_clock, SystemClock.elapsedRealtime() + leftMs, null, true);
        view.setChronometerCountDown(R.id.rest_live_clock, true);
    }

    private static void countUp(RemoteViews view, long elapsedMs) {
        view.setViewVisibility(R.id.rest_live_clock, View.VISIBLE);
        view.setChronometer(R.id.rest_live_clock, SystemClock.elapsedRealtime() - elapsedMs, null, true);
        view.setChronometerCountDown(R.id.rest_live_clock, false);
    }

    private static void title(RemoteViews view, String text) {
        view.setViewVisibility(R.id.rest_live_title, View.VISIBLE);
        view.setTextViewText(R.id.rest_live_title, text);
    }

    private static void line(RemoteViews view, String text) {
        boolean shown = text != null && !text.isEmpty();
        view.setViewVisibility(R.id.rest_live_line, shown ? View.VISIBLE : View.GONE);
        if (shown) view.setTextViewText(R.id.rest_live_line, text);
    }

    /** "1:05:12" past an hour, "31:40" before, as the app's workoutClock. */
    private static String clock(int seconds) {
        int hours = seconds / 3600;
        int minutes = (seconds / 60) % 60;
        int rest = seconds % 60;
        return hours > 0
                ? String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, rest)
                : String.format(Locale.ROOT, "%d:%02d", minutes, rest);
    }

    private static void stopTicking() {
        if (tick != null) HANDLER.removeCallbacks(tick);
        tick = null;
    }

    private static boolean canNotify(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    /**
     * Whether Go sounds now: the first time it is drawn for this rest, within
     * a minute of the end, with the app not on screen. Once drawn quietly (the
     * app was open, or the end is long past) it never sounds later.
     */
    private static boolean goIsNews(Context context, long end, long now) {
        SharedPreferences prefs = prefs(context);
        if (prefs.getLong(KEY_ALERTED, 0) == end) return false;
        prefs.edit().putLong(KEY_ALERTED, end).apply();
        return !inFront && now - end < ALERT_WINDOW_MS;
    }

    /** An exact alarm at the rest's end, so Go is drawn, and sounds, with the process gone. */
    private static void scheduleGo(Context context, long at) {
        if (goAt == at) return;
        goAt = at;
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent go = broadcast(context, ACTION_GO);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, go);
        } else {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, go);
        }
    }

    /** No rest running: no Go to come. Always, since a new process does not know what an old one set. */
    private static void cancelGo(Context context) {
        goAt = 0;
        context.getSystemService(AlarmManager.class).cancel(broadcast(context, ACTION_GO));
    }

    /** "Rest over" on its own, for a workout whose notification was swiped away. */
    private static void postRestOver(Context context, JSONObject labels, String goLine) {
        ensureAlertChannel(context, labels.optString("alertTitle", "Rest over"));
        // The set to do, as the web side's alert says it; the sentence when nothing is known.
        String body = goLine;
        if (body == null || body.isEmpty() || body.equals(labels.optString("restOver"))) {
            body = labels.optString("alertBody");
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_motionhive)
                .setColor(ContextCompat.getColor(context, R.color.mh_notification_accent))
                .setContentTitle(labels.optString("alertTitle"))
                .setContentText(body)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openApp(context));
        try {
            NotificationManagerCompat.from(context).notify(REST_ALERT_ID, builder.build());
        } catch (SecurityException denied) {
            // Notifications refused: nothing to show.
        }
    }

    /** High importance: Go sounds and peeks over the screen, as a timer's end does. */
    private static void ensureAlertChannel(Context context, String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel =
                new NotificationChannel(ALERT_CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setShowBadge(false);
        channel.enableVibration(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        // Creating it again only renames it, in the person's language.
        manager.createNotificationChannel(channel);
    }

    /** Low importance: it sits in the shade and on the lock screen without a sound. */
    private static void ensureChannel(Context context, String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        // Creating it again only renames it, in the person's language.
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent broadcast(Context context, String action) {
        Intent intent = new Intent(context, RestLiveReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(
                context, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Log set, for the set it is drawn beside. The set id rides in the data,
     * so each set's button is its own PendingIntent: an extra alone would be
     * rewritten in place by FLAG_UPDATE_CURRENT, the old button included.
     */
    private static PendingIntent logBroadcast(Context context, String setId) {
        Intent intent = new Intent(context, RestLiveReceiver.class).setAction(ACTION_LOG);
        if (setId != null && !setId.isEmpty()) {
            intent.setData(new Uri.Builder().scheme("motionhive").authority("set").appendPath(setId).build());
        }
        return PendingIntent.getBroadcast(
                context, ACTION_LOG.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** The set a Log set button was drawn for; null on one from before it carried it. */
    static String loggedSetId(Intent intent) {
        Uri data = intent.getData();
        return data == null ? null : data.getLastPathSegment();
    }

    private static PendingIntent openApp(Context context) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                context, NOTIFICATION_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ─── Kept in preferences ───────────────────────────────────────

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject load(Context context) {
        String raw = prefs(context).getString(KEY_STATE, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException broken) {
            return null;
        }
    }

    private static void save(Context context, JSONObject state) {
        prefs(context).edit().putString(KEY_STATE, state.toString()).apply();
    }

    private static JSONArray pending(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_ACTIONS, "[]"));
        } catch (JSONException broken) {
            return new JSONArray();
        }
    }

    private static void record(Context context, JSONObject action) {
        JSONArray actions = pending(context).put(action);
        prefs(context).edit().putString(KEY_ACTIONS, actions.toString()).apply();
        Runnable notify = listener;
        if (notify != null) HANDLER.post(notify);
    }

    private static JSONObject action(String type, long at) {
        JSONObject action = new JSONObject();
        put(action, "type", type);
        put(action, "at", at);
        return action;
    }

    private static void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value);
        } catch (JSONException ignored) {
            // Only thrown for a null key or a non-finite number; neither happens here.
        }
    }

    private static void copy(JSONObject from, JSONObject to, String key) {
        if (from.has(key) && !from.isNull(key)) put(to, key, from.opt(key));
        else to.remove(key);
    }
}
