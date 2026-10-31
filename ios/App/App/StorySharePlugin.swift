import Capacitor
import Photos
import UIKit
import UniformTypeIdentifiers

/// MotionHive's own plugin for getting a share picture off the phone: an
/// Instagram Story through Instagram's Stories API, the photo library, and
/// the clipboard as an image. The web side is
/// `projects/mobile/src/app/_shared/native/story-share.ts`; registered in
/// `MainViewController`.
///
/// Images arrive as base64 without a `data:` prefix. Rejections carry a
/// code the web side reads: `UNAVAILABLE` (Instagram is not installed) and
/// `DENIED` (adding to Photos is not allowed).
@objc(StorySharePlugin)
public class StorySharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorySharePlugin"
    public let jsName = "StoryShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isInstagramAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareToStory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copyImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openInstagram", returnType: CAPPluginReturnPromise)
    ]

    /// Both schemes are listed under `LSApplicationQueriesSchemes` in Info.plist;
    /// without that, `canOpenURL` answers false whether Instagram is there or not.
    private static let storiesURL = "instagram-stories://share"
    private static let appURL = "instagram://app"
    /// Instagram reads the pasteboard when it opens; the items expire on their own after.
    private static let pasteboardLifetime: TimeInterval = 5 * 60
    private static let unavailable = "UNAVAILABLE"
    private static let denied = "DENIED"

    private enum StickerKey {
        static let sticker = "com.instagram.sharedSticker.stickerImage"
        static let background = "com.instagram.sharedSticker.backgroundImage"
        static let topColor = "com.instagram.sharedSticker.backgroundTopColor"
        static let bottomColor = "com.instagram.sharedSticker.backgroundBottomColor"
    }

    @objc func isInstagramAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["available": Self.canOpen(Self.storiesURL)])
        }
    }

    /// Puts the sticker (and the photo, or the two colours) on the pasteboard
    /// for five minutes and opens Instagram's Story editor, which reads it.
    @objc func shareToStory(_ call: CAPPluginCall) {
        guard let appId = call.getString("sourceApplication"), !appId.isEmpty else {
            call.reject("sourceApplication is required")
            return
        }
        guard let sticker = Self.imageData(call, "stickerImage") else {
            call.reject("stickerImage must be base64 image data")
            return
        }
        var item: [String: Any] = [StickerKey.sticker: sticker]
        if let background = Self.imageData(call, "backgroundImage") {
            item[StickerKey.background] = background
        } else {
            if let top = call.getString("backgroundTopColor") { item[StickerKey.topColor] = top }
            if let bottom = call.getString("backgroundBottomColor") { item[StickerKey.bottomColor] = bottom }
        }
        var components = URLComponents(string: Self.storiesURL)
        components?.queryItems = [URLQueryItem(name: "source_application", value: appId)]
        guard let url = components?.url else {
            call.reject("Could not build the Instagram address")
            return
        }

        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(url) else {
                call.reject("Instagram is not installed", Self.unavailable)
                return
            }
            UIPasteboard.general.setItems(
                [item],
                options: [.expirationDate: Date().addingTimeInterval(Self.pasteboardLifetime)]
            )
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Instagram did not open", Self.unavailable)
                }
            }
        }
    }

    /// Add-only access: the app can put the card in Photos and never read them.
    @objc func saveToPhotos(_ call: CAPPluginCall) {
        guard let image = Self.imageData(call, "image") else {
            call.reject("image must be base64 image data")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.reject("Adding to Photos is not allowed", Self.denied)
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: image, options: nil)
            }, completionHandler: { saved, error in
                if saved {
                    call.resolve()
                } else {
                    call.reject(error?.localizedDescription ?? "Could not add to Photos", nil, error)
                }
            })
        }
    }

    /// PNG on the pasteboard, so the sticker keeps its transparency when pasted into a Story.
    @objc func copyImage(_ call: CAPPluginCall) {
        guard let image = Self.imageData(call, "image") else {
            call.reject("image must be base64 image data")
            return
        }
        DispatchQueue.main.async {
            UIPasteboard.general.setItems([[UTType.png.identifier: image]])
            call.resolve()
        }
    }

    @objc func openInstagram(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: Self.appURL), UIApplication.shared.canOpenURL(url) else {
                call.resolve(["opened": false])
                return
            }
            UIApplication.shared.open(url, options: [:]) { opened in
                call.resolve(["opened": opened])
            }
        }
    }

    private static func canOpen(_ address: String) -> Bool {
        guard let url = URL(string: address) else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    private static func imageData(_ call: CAPPluginCall, _ key: String) -> Data? {
        guard let base64 = call.getString(key), !base64.isEmpty else { return nil }
        return Data(base64Encoded: base64, options: .ignoreUnknownCharacters)
    }
}
