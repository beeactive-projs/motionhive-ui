package fit.motionhive.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * MotionHive's own plugin for getting a share picture off the phone: an
 * Instagram Story through Instagram's Stories API and the photo library.
 * The web side is projects/mobile/src/app/_shared/native/story-share.ts;
 * registered in MainActivity.
 *
 * Images arrive as base64 without a data: prefix. Rejections carry a code
 * the web side reads: UNAVAILABLE (Instagram is not installed, or the
 * clipboard image, which is an iOS idea) and DENIED (storage refused on
 * Android 9 and older).
 */
@CapacitorPlugin(
    name = "StoryShare",
    permissions = {
        @Permission(alias = StorySharePlugin.STORAGE, strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class StorySharePlugin extends Plugin {

    static final String STORAGE = "storage";

    private static final String INSTAGRAM = "com.instagram.android";
    private static final String ADD_TO_STORY = "com.instagram.share.ADD_TO_STORY";
    private static final String UNAVAILABLE = "UNAVAILABLE";
    private static final String DENIED = "DENIED";
    /** Under the cache folder the FileProvider already shares (res/xml/file_paths.xml). */
    private static final String SHARE_DIR = "story-share";

    @PluginMethod
    public void isInstagramAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", storyIntent().resolveActivity(getContext().getPackageManager()) != null);
        call.resolve(result);
    }

    /**
     * Hands Instagram the sticker as an interactive asset over the photo
     * (the intent's data) or the two colours, as content URIs it may read.
     */
    @PluginMethod
    public void shareToStory(PluginCall call) {
        String appId = call.getString("sourceApplication");
        String sticker = call.getString("stickerImage");
        if (appId == null || appId.isEmpty() || sticker == null || sticker.isEmpty()) {
            call.reject("sourceApplication and stickerImage are required");
            return;
        }
        Activity activity = getActivity();
        Intent intent = storyIntent();
        if (intent.resolveActivity(activity.getPackageManager()) == null) {
            call.reject("Instagram is not installed", UNAVAILABLE);
            return;
        }
        try {
            intent.putExtra("source_application", appId);
            Uri stickerUri = writeShareFile(sticker, "sticker.png");
            intent.putExtra("interactive_asset_uri", stickerUri);
            activity.grantUriPermission(INSTAGRAM, stickerUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            String background = call.getString("backgroundImage");
            if (background != null && !background.isEmpty()) {
                Uri backgroundUri = writeShareFile(background, "background.jpg");
                intent.setDataAndType(backgroundUri, "image/jpeg");
                activity.grantUriPermission(INSTAGRAM, backgroundUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setType("image/*");
                String top = call.getString("backgroundTopColor");
                String bottom = call.getString("backgroundBottomColor");
                if (top != null) intent.putExtra("top_background_color", top);
                if (bottom != null) intent.putExtra("bottom_background_color", bottom);
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);
            call.resolve();
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Could not prepare the Story", null, e);
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Instagram is not installed", UNAVAILABLE, e);
        } catch (RuntimeException e) {
            // Anything else (a refused grant, a SecurityException) fails the
            // call: the bridge rethrows an uncaught one and the app would crash.
            call.reject("Could not prepare the Story", null, e);
        }
    }

    /**
     * MediaStore needs no permission from Android 10; below it, the old
     * storage permission (declared with maxSdkVersion 28) is asked once.
     */
    @PluginMethod
    public void saveToPhotos(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(STORAGE) != PermissionState.GRANTED) {
            requestPermissionForAlias(STORAGE, call, "storagePermissionCallback");
            return;
        }
        save(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState(STORAGE) == PermissionState.GRANTED) {
            save(call);
        } else {
            call.reject("Saving to the gallery is not allowed", DENIED);
        }
    }

    /** The clipboard image is iOS only; the web side hides the button elsewhere. */
    @PluginMethod
    public void copyImage(PluginCall call) {
        call.reject("Copying an image is not available on Android", UNAVAILABLE);
    }

    @PluginMethod
    public void openInstagram(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent launch = packageManager.getLaunchIntentForPackage(INSTAGRAM);
        JSObject result = new JSObject();
        if (launch == null) {
            result.put("opened", false);
            call.resolve(result);
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(launch);
            result.put("opened", true);
        } catch (RuntimeException e) {
            result.put("opened", false);
        }
        call.resolve(result);
    }

    private Intent storyIntent() {
        Intent intent = new Intent(ADD_TO_STORY);
        intent.setPackage(INSTAGRAM);
        intent.setType("image/*");
        return intent;
    }

    private void save(PluginCall call) {
        String image = call.getString("image");
        if (image == null || image.isEmpty()) {
            call.reject("image is required");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(image, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("image must be base64 image data", null, e);
            return;
        }
        // The card is a PNG, or a JPEG when it carries a photo: named by its bytes.
        boolean jpeg = bytes.length > 2 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8;
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(
            MediaStore.Images.Media.DISPLAY_NAME,
            "motionhive-workout-" + System.currentTimeMillis() + (jpeg ? ".jpg" : ".png")
        );
        values.put(MediaStore.Images.Media.MIME_TYPE, jpeg ? "image/jpeg" : "image/png");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MotionHive");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("No gallery entry");
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new IOException("No output stream");
                out.write(bytes);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues done = new ContentValues();
                done.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            }
        } catch (IOException | RuntimeException e) {
            // A half-written entry would show as a broken image in the gallery.
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("Could not add to the gallery", null, e);
            return;
        }
        call.resolve();
    }

    /** Writes the image under the cache and returns a content URI another app can be granted. */
    private Uri writeShareFile(String base64, String name) throws IOException {
        File dir = new File(getContext().getCacheDir(), SHARE_DIR);
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not create " + dir);
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(Base64.decode(base64, Base64.DEFAULT));
        }
        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
    }
}
