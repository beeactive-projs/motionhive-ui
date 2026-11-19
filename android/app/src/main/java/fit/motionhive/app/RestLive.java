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
 * Workout, "Outside the app"): the rest counting down with +15 s, Skip and
 * Open; Go with Start set once it is over; the workout's name and clock
 * between sets. The countdown and the clock are the system's Chronometer,
 * so they keep time with the app asleep; the bar under the rest moves once
 * a second while the process lives.
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
                builder.addAction(0, labels.optString("plus"), broadcast(context, ACTION_EXTEND));
                builder.addAction(0, labels.optString("skip"), broadcast(context, ACTION_SKIP));
                break;
            }
            case GO: {
                subText = labels.optString("restOver");
                title(view, labels.optString("go"));
                view.setViewVisibility(R.id.rest_live_clock, View.GONE);
                line(view, state.optString("goLine"));
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                builder.addAction(0, labels.optString("startSet"), broadcast(context, ACTION_START));
                break;
            }
            case WORKOUT: {
                subText = labels.optString("workout");
                title(view, title + " · ");
                countUp(view, now - clockFrom);
                line(view, workoutLine);
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                break;
            }
            default: {
                subText = labels.optString("workout");
                title(view, title + " · " + clock(state.optInt("pausedSeconds", 0)));
                view.setViewVisibility(R.id.rest_live_clock, View.GONE);
                line(view, labels.optString("paused"));
                view.setViewVisibility(R.id.rest_live_progress, View.GONE);
                break;
            }
        }
        builder.addAction(0, labels.optString("open"), openApp(context));

        builder.setSmallIcon(R.drawable.ic_stat_motionhive)
                .setColor(ContextCompat.getColor(context, R.color.mh_notification_accent))
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(view)
                .setCustomBigContentView(view)
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
