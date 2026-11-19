import UIKit
import Capacitor
import FBSDKCoreKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Capacitor's bridge with the app's own plugins registered (StoryShare).
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Facebook's login answers through the fb<app id> scheme (Info.plist)
        // and its SDK takes those links; every other link goes to Capacitor
        // (the app's own motionhive:// links, AppLinkService).
        var others = Set<UIOpenURLContext>()
        for context in URLContexts {
            let handledByFacebook = ApplicationDelegate.shared.application(
                UIApplication.shared,
                open: context.url,
                sourceApplication: context.options.sourceApplication,
                annotation: context.options.annotation
            )
            if !handledByFacebook {
                others.insert(context)
            }
        }
        if !others.isEmpty {
            SceneDelegateProxy.shared.scene(scene, openURLContexts: others)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
