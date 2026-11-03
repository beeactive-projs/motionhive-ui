package fit.motionhive.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * The buttons on the workout's ongoing notification (+15 s, Skip, Start set)
 * and its swipe away. Each does its work at once, app running or not; see
 * {@link RestLive}. Declared in AndroidManifest.xml, not exported.
 */
public class RestLiveReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        switch (action) {
            case RestLive.ACTION_EXTEND:
                RestLive.extend(context);
                break;
            case RestLive.ACTION_SKIP:
                RestLive.endRest(context, "skip");
                break;
            case RestLive.ACTION_START:
                RestLive.endRest(context, "start");
                break;
            case RestLive.ACTION_DISMISSED:
                RestLive.dismissed(context);
                break;
            default:
                break;
        }
    }
}
