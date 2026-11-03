package fit.motionhive.app;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

/**
 * The workout on the lock screen: shows, updates and removes the ongoing
 * notification ({@link RestLive}) and hands the web side what its buttons
 * did. The web side is projects/mobile/src/app/_shared/native/rest-live.ts;
 * registered in MainActivity. The iOS twin is RestLivePlugin.swift (a Live
 * Activity).
 */
@CapacitorPlugin(name = "RestLive")
public class RestLivePlugin extends Plugin {

    @Override
    public void load() {
        // A button tapped while the web side runs: it comes to take the notes.
        RestLive.listener = () -> notifyListeners("action", new JSObject());
    }

    @Override
    protected void handleOnDestroy() {
        RestLive.listener = null;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void show(PluginCall call) {
        String logId = call.getString("logId");
        if (logId == null || logId.isEmpty()) {
            call.reject("logId is required");
            return;
        }
        RestLive.show(getContext(), call.getData());
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        RestLive.end(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takeActions(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("actions", new JSArray(RestLive.take(getContext()).toString()));
        } catch (JSONException broken) {
            result.put("actions", new JSArray());
        }
        call.resolve(result);
    }
}
