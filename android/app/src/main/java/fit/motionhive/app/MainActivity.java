package fit.motionhive.app;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The text-size range, the same as TEXT_SIZE in text-size.config.ts.
    private static final int MIN_TEXT_ZOOM = 100;
    private static final int MAX_TEXT_ZOOM = 130;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this app, not in an npm package, are registered
        // here, before the bridge starts (Capacitor 4+).
        registerPlugin(StorySharePlugin.class);
        registerPlugin(RestLivePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        // Before super: it tells the web side the app is active, and the web
        // side then measures the zoom to size its root.
        capTextZoom();
        super.onResume();
    }

    /**
     * The WebView starts its text zoom at the system font scale, with no
     * ceiling; the largest accessibility sizes reach 200% and more.
     */
    private void capTextZoom() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        int system = Math.round(getResources().getConfiguration().fontScale * 100);
        settings.setTextZoom(Math.max(MIN_TEXT_ZOOM, Math.min(MAX_TEXT_ZOOM, system)));
    }
}
