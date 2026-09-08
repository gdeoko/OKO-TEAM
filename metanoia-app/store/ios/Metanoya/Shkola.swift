//  Метанойя · обёртка для App Store
//
//  Приложение открывает школу в собственном окне WKWebView. Содержимого
//  внутри нет, всё живёт на сайте школы: обновили уроки на сервере, и
//  обновление увидели все, без новой версии в магазине.
//
//  Адрес школы стоит в одном месте: Info.plist, ключ MTSchoolURL.

import UIKit
import WebKit

let КРЕМ = UIColor(red: 0.980, green: 0.973, blue: 0.961, alpha: 1)   // #FAF8F5
let НОЧЬ = UIColor(red: 0.055, green: 0.106, blue: 0.145, alpha: 1)   // #0E1B25

final class ЭкранШколы: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {

    private var окно: WKWebView!
    private let плашка = UILabel()
    private var адрес: URL {
        let s = Bundle.main.object(forInfoDictionaryKey: "MTSchoolURL") as? String ?? ""
        return URL(string: s) ?? URL(string: "https://example.org/")!
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let настройки = WKWebViewConfiguration()
        настройки.allowsInlineMediaPlayback = true                    // видеокружочки играют в потоке
        настройки.mediaTypesRequiringUserActionForPlayback = []       // озвучка урока стартует по нашей кнопке
        настройки.defaultWebpagePreferences.allowsContentJavaScript = true
        настройки.websiteDataStore = .default()                       // память приложения переживает перезапуск
        // Чтобы в журналах сервера было видно, что зашли из приложения App Store,
        // а не из браузера. Обычная открытая настройка, приватных ключей не трогаем.
        настройки.applicationNameForUserAgent = "MetanoyaApp/1.0"

        окно = WKWebView(frame: .zero, configuration: настройки)
        окно.navigationDelegate = self
        окно.uiDelegate = self
        окно.allowsBackForwardNavigationGestures = false              // экраны листает само приложение
        окно.scrollView.bounces = false
        окно.scrollView.contentInsetAdjustmentBehavior = .never
        окно.isOpaque = false
        окно.backgroundColor = фонПоТеме()
        окно.scrollView.backgroundColor = фонПоТеме()
        окно.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = фонПоТеме()
        view.addSubview(окно)
        NSLayoutConstraint.activate([
            окно.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            окно.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            окно.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            окно.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        плашка.text = "Школа не открылась: нет связи.\nПотяните вниз, когда сеть вернётся."
        плашка.numberOfLines = 0
        плашка.textAlignment = .center
        плашка.textColor = UIColor(red: 0.10, green: 0.23, blue: 0.32, alpha: 1)
        плашка.isHidden = true
        плашка.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(плашка)
        NSLayoutConstraint.activate([
            плашка.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            плашка.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            плашка.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
        ])

        let тяга = UIRefreshControl()
        тяга.addTarget(self, action: #selector(перезагрузить), for: .valueChanged)
        окно.scrollView.refreshControl = тяга

        окно.load(URLRequest(url: адрес))
    }

    private func фонПоТеме() -> UIColor {
        traitCollection.userInterfaceStyle == .dark ? НОЧЬ : КРЕМ
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        view.backgroundColor = фонПоТеме()
        окно.backgroundColor = фонПоТеме()
        окно.scrollView.backgroundColor = фонПоТеме()
    }

    @objc private func перезагрузить() {
        плашка.isHidden = true
        окно.load(URLRequest(url: адрес))
    }

    // MARK: связь

    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        w.scrollView.refreshControl?.endRefreshing()
        плашка.isHidden = true
    }

    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { обрыв(w) }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { обрыв(w) }

    private func обрыв(_ w: WKWebView) {
        w.scrollView.refreshControl?.endRefreshing()
        плашка.isHidden = w.url != nil          // уже открытую школу не завешиваем
    }

    // Ссылки наружу (например «написать педагогу») уходят в Safari,
    // школа остаётся открытой.
    func webView(_ w: WKWebView, decidePolicyFor действие: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = действие.request.url else { return decisionHandler(.allow) }
        if u.scheme == "tel" || u.scheme == "mailto" || u.scheme == "tg" {
            UIApplication.shared.open(u); return decisionHandler(.cancel)
        }
        let свой = u.host == адрес.host || u.scheme == "about" || u.scheme == "blob" || u.scheme == "data"
        if !свой, действие.navigationType == .linkActivated {
            UIApplication.shared.open(u); return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // Окна target=_blank открываем в том же окне, иначе они просто гаснут.
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration,
                 for действие: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if действие.targetFrame == nil, let u = действие.request.url { UIApplication.shared.open(u) }
        return nil
    }

    // MARK: микрофон и камера в чатах

    @available(iOS 15.0, *)
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        // Спрашивать второй раз незачем: система уже спросила своим окном
        // по ключам NSMicrophoneUsageDescription и NSCameraUsageDescription.
        decisionHandler(origin.host == адрес.host ? .grant : .deny)
    }

    // MARK: сохранение сертификата и альбома

    func webView(_ w: WKWebView, navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) { download.delegate = self }

    func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse,
                 didBecome download: WKDownload) { download.delegate = self }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let имя = suggestedFilename.isEmpty ? "metanoya.png" : suggestedFilename
        let куда = FileManager.default.temporaryDirectory.appendingPathComponent(имя)
        try? FileManager.default.removeItem(at: куда)
        completionHandler(куда)
        последнийФайл = куда
    }

    private var последнийФайл: URL?

    func downloadDidFinish(_ download: WKDownload) {
        guard let файл = последнийФайл else { return }
        let лист = UIActivityViewController(activityItems: [файл], applicationActivities: nil)
        лист.popoverPresentationController?.sourceView = view
        present(лист, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        последнийФайл = nil
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }
}

@main
final class Запуск: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ app: UIApplication,
                     didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = ЭкранШколы()
        w.makeKeyAndVisible()
        window = w
        return true
    }
}
