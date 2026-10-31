import Capacitor
import UIKit

/// The app's bridge view controller: Capacitor's own, plus the plugins that
/// live in this app instead of an npm package (Capacitor 8 registers those
/// here, not by discovery). `SceneDelegate` builds this one, and
/// `Main.storyboard` names it too.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorySharePlugin())
    }
}
