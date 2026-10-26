import type { Locale } from "./i18n/config";
import type { LegalSettings } from "./legal-settings-shared";
export const copy = (locale: Locale, en: string, de: string, tr: string) =>
  ({ en, de, tr })[locale];
export const trademarkNote = (l: Locale) =>
  copy(
    l,
    "TYPO3 is a registered trademark of the TYPO3 Association. CMSMotive is an independent provider of themes and extensions for TYPO3 CMS and is not affiliated with or endorsed by the TYPO3 Association.",
    "TYPO3 ist eine eingetragene Marke der TYPO3 Association. CMSMotive ist ein unabhängiger Anbieter von Themes und Erweiterungen für TYPO3 CMS und weder mit der TYPO3 Association verbunden noch von ihr unterstützt.",
    "TYPO3, TYPO3 Association'ın tescilli markasıdır. CMSMotive, TYPO3 CMS için tema ve eklentiler sunan bağımsız bir sağlayıcıdır; TYPO3 Association ile bağlantılı değildir ve onun tarafından onaylanmamıştır.",
  );
export type LegalSlug = "imprint" | "privacy" | "terms" | "cookies";
export const legalTitle = (slug: LegalSlug, l: Locale) =>
  ({
    imprint: copy(l, "Imprint", "Impressum", "Yasal bilgiler"),
    privacy: copy(
      l,
      "Privacy policy",
      "Datenschutzerklärung",
      "Gizlilik politikası",
    ),
    terms: copy(
      l,
      "Account and product terms",
      "Konto- und Produktbedingungen",
      "Hesap ve ürün koşulları",
    ),
    cookies: copy(
      l,
      "Cookies and local storage",
      "Cookies und lokale Speicherung",
      "Çerezler ve yerel depolama",
    ),
  })[slug];

export function legalSections(slug: LegalSlug, l: Locale, s: LegalSettings) {
  const c = (en: string, de: string, tr: string) => copy(l, en, de, tr);
  const pending = c(
    "Information awaiting confirmation by the provider.",
    "Angabe wird vom Anbieter noch bestätigt.",
    "Bu bilgi sağlayıcı tarafından henüz doğrulanmadı.",
  );
  const section = (title: string, ...paragraphs: string[]) => ({
    title,
    paragraphs,
  });
  const identity = section(
    c(
      "Provider and controller",
      "Anbieter und Verantwortlicher",
      "Sağlayıcı ve veri sorumlusu",
    ),
    s.legalName || pending,
    s.address || pending,
    s.country || pending,
    `${c("Contact", "Kontakt", "İletişim")}: ${s.contactEmail}`,
    `${c("Privacy contact", "Datenschutzkontakt", "Gizlilik iletişimi")}: ${s.privacyEmail}`,
  );
  if (slug === "imprint")
    return [
      identity,
      section(
        c(
          "Representation and registration",
          "Vertretung und Register",
          "Temsil ve kayıt bilgileri",
        ),
        s.representative,
        s.registerDetails,
        s.vatId
          ? `VAT / Tax ID: ${s.vatId}`
          : c(
              "For billing and provider details, contact the address above. Statutory registration and tax information will be added where applicable.",
              "Fragen zu Abrechnung und Anbieterangaben richten Sie an die obige Adresse. Gesetzlich erforderliche Register- und Steuerangaben werden gegebenenfalls ergänzt.",
              "Faturalama ve sağlayıcı bilgileri için yukarıdaki adrese ulaşabilirsiniz. Mevzuat gereği gerekli sicil ve vergi bilgileri ayrıca tamamlanacaktır.",
            ),
      ),
      section(
        c(
          "Independent provider",
          "Unabhängiger Anbieter",
          "Bağımsız sağlayıcı",
        ),
        trademarkNote(l),
      ),
    ];
  if (slug === "terms")
    return [
      identity,
      section(
        c(
          "Scope and accounts",
          "Geltungsbereich und Konten",
          "Kapsam ve hesaplar",
        ),
        c(
          "These terms cover browsing and CMSMotive accounts. Keep account credentials secure and provide accurate contact details. Do not attempt unauthorized access, abuse forms or publish unlawful content. Account registration does not constitute a product purchase or a TYPO3 Association account.",
          "Diese Bedingungen gelten für die Website und CMSMotive-Konten. Zugangsdaten sind sicher aufzubewahren und Kontaktdaten korrekt anzugeben. Unbefugte Zugriffe, Formularmissbrauch und rechtswidrige Inhalte sind nicht zulässig. Ein Konto ist weder ein Produktkauf noch ein Konto der TYPO3 Association.",
          "Bu koşullar siteyi ve CMSMotive hesaplarını kapsar. Hesap bilgilerinizi güvenli tutun ve doğru iletişim bilgileri verin. Yetkisiz erişim, form kötüye kullanımı ve hukuka aykırı içerik paylaşımı yasaktır. Hesap açmak ürün satın almak veya TYPO3 Association hesabı açmak anlamına gelmez.",
        ),
      ),
      section(
        c(
          "Product availability and purchases",
          "Verfügbarkeit und Käufe",
          "Ürün durumu ve satın alma",
        ),
        c(
          "Concepts and roadmap items cannot be purchased. Checkout is available only for released products with enabled billing plans. Registering, contacting us or selecting a plan does not create a purchase. Review the product specifications, total price and applicable terms before placing a paid order.",
          "Konzepte und Roadmap-Produkte sind nicht kaufbar. Checkout steht nur für veröffentlichte Produkte mit aktivierten Zahlungsplänen zur Verfügung. Registrierung, Kontakt oder Planauswahl lösen keinen Kauf aus. Prüfen Sie Spezifikation, Gesamtpreis und Bedingungen vor einer kostenpflichtigen Bestellung.",
          "Konsept ve yol haritası ürünleri satın alınamaz. Ödeme yalnız yayımlanmış ve ödeme planı etkin ürünlerde açılır. Kayıt, iletişim veya plan seçimi satın alma oluşturmaz. Ücretli siparişten önce ürün özelliklerini, toplam fiyatı ve geçerli koşulları inceleyin.",
        ),
      ),
      section(
        c(
          "Annual subscriptions and cancellation",
          "Jährliche Abonnements und Kündigung",
          "Yıllık abonelik ve iptal",
        ),
        c(
          "Paid service plans are subscriptions billed annually, with 12 months of updates and support per paid period. The annual amount is charged at purchase and subsequently every year until cancelled, subject to applicable law and the checkout terms. Recurring billing requires a separate express confirmation at checkout. Use My account → Subscriptions & invoices to manage cancellation, or contact info@cmsmotive.de. Mandatory termination, refund and consumer rights remain unaffected. The legal classification and renewal rules must be reviewed before live consumer sales.",
          "Kostenpflichtige Servicepläne werden jährlich abgerechnet und umfassen je bezahlter Periode 12 Monate Updates und Support. Der Jahresbetrag wird beim Kauf und danach jährlich bis zur Kündigung erhoben, vorbehaltlich anwendbaren Rechts und Checkout-Bedingungen. Die wiederkehrende Zahlung wird separat bestätigt. Kündigungen sind unter Mein Konto → Abos & Rechnungen oder über info@cmsmotive.de möglich. Zwingende Kündigungs-, Erstattungs- und Verbraucherrechte bleiben unberührt. Die rechtliche Einordnung und Verlängerung sind vor Verbraucherverkäufen zu prüfen.",
          "Ücretli hizmet planları her ücretli dönem için 12 ay güncelleme ve destek içeren, yıllık faturalandırılan aboneliklerdir. Yıllık tutar satın almada ve iptal edilene kadar her yıl, uygulanacak hukuk ve ödeme koşulları saklı kalmak üzere tahsil edilir. Tekrarlayan tahsilat için ödeme öncesi ayrı açık onay alınır. İptali Hesabım → Abonelikler ve faturalar alanından veya info@cmsmotive.de üzerinden yönetebilirsiniz. Emredici fesih, iade ve tüketici hakları saklıdır. Canlı tüketici satışından önce sözleşmenin hukuki niteliği ve yenileme kuralları doğrulanmalıdır.",
        ),
      ),
      section(
        c(
          "Payment, invoices and delivery",
          "Zahlung, Rechnungen und Lieferung",
          "Ödeme, fatura ve teslimat",
        ),
        c(
          "Creem is the merchant of record for checkout transactions and issues payment invoices. Its seller identity and payment terms are shown at checkout. CMSMotive supplies the product and support. Card data is entered on Creem, not stored by CMSMotive. Payment confirmation unlocks the applicable private package downloads in your account. If delivery fails, contact info@cmsmotive.de. Previously delivered GPL code remains usable after cancellation; new updates and support depend on the paid service period.",
          "Creem ist Merchant of Record der Checkout-Transaktionen und stellt Zahlungsrechnungen aus. Verkäuferidentität und Zahlungsbedingungen werden im Checkout angezeigt. CMSMotive liefert Produkt und Support. Kartendaten werden bei Creem eingegeben und nicht bei CMSMotive gespeichert. Nach Zahlungsbestätigung werden private Paketdownloads im Konto freigeschaltet. Bei Lieferproblemen wenden Sie sich an info@cmsmotive.de. Ausgelieferter GPL-Code bleibt nach Kündigung nutzbar; neue Updates und Support hängen von der bezahlten Serviceperiode ab.",
          "Ödeme işlemlerinde kayıtlı satıcı (Merchant of Record) Creem'dir ve ödeme faturasını düzenler; satıcı kimliği ve ödeme koşulları ödeme ekranında gösterilir. CMSMotive ürün ve destek sağlar. Kart verileri Creem'de girilir, CMSMotive'de saklanmaz. Ödeme onayı hesabınızdaki ilgili özel paket indirmelerini açar. Teslimat sorunu için info@cmsmotive.de adresine ulaşın. Teslim edilmiş GPL kodu iptalden sonra kullanılabilir; yeni güncellemeler ve destek ücretli hizmet dönemine bağlıdır.",
        ),
      ),
      section(
        c(
          "Software licenses and paid services",
          "Softwarelizenzen und kostenpflichtige Leistungen",
          "Yazılım lisansları ve ücretli hizmetler",
        ),
        c(
          "The license stated in the delivered package (its LICENSE or COPYING file) governs its code. Code delivered under the GNU General Public License may be used on any number of sites, studied, modified and redistributed under that license; nothing in these terms restricts those rights, and the source code is part of the package. Paid distribution, licence keys, installation counts, updates and support describe our services only and are separate from the rights granted by an applicable open-source license. The CMSMotive name and logo are not licensed with the code. Images, fonts and other non-code assets, and bundled third-party libraries, follow the licenses listed in the package notices. Support and update periods, renewal, taxes and delivery must be confirmed for each released product.",
          "Für den Code gilt die im ausgelieferten Paket genannte Lizenz (Datei LICENSE oder COPYING). Unter der GNU General Public License gelieferter Code darf auf beliebig vielen Websites genutzt, untersucht, verändert und unter dieser Lizenz weitergegeben werden; diese Bedingungen schränken diese Rechte nicht ein, und der Quellcode ist Teil des Pakets. Kostenpflichtige Auslieferung, Lizenzschlüssel, Installationszahlen, Updates und Support beschreiben nur unsere Leistungen und sind von den Rechten einer anwendbaren Open-Source-Lizenz zu unterscheiden. Name und Logo von CMSMotive werden mit dem Code nicht lizenziert. Bilder, Schriften und andere Nicht-Code-Inhalte sowie mitgelieferte Bibliotheken Dritter unterliegen den in den Pakethinweisen genannten Lizenzen. Support, Updates, Verlängerung, Steuern und Lieferung sind je Produkt zu bestätigen.",
          "Kod için teslim edilen paketteki lisans (LICENSE veya COPYING dosyası) geçerlidir. GNU Genel Kamu Lisansı (GPL) ile teslim edilen kod, bu lisans kapsamında istenen sayıda sitede kullanılabilir, incelenebilir, değiştirilebilir ve yeniden dağıtılabilir; bu koşullar söz konusu hakları kısıtlamaz ve kaynak kod paketin parçasıdır. Ücretli dağıtım, lisans anahtarları, kurulum sayıları, güncelleme ve destek yalnızca hizmetlerimizi tanımlar ve geçerli açık kaynak lisansının verdiği haklardan ayrıdır. CMSMotive adı ve logosu kodla birlikte lisanslanmaz. Görseller, yazı tipleri ve diğer kod dışı içerikler ile pakete dahil üçüncü taraf kütüphaneler paket bildirimlerinde belirtilen lisanslara tabidir. Destek ve güncelleme süreleri, yenileme, vergiler ve teslimat her ürün için kesinleştirilmelidir.",
        ),
      ),
      section(
        c(
          "Consumer rights and complaints",
          "Verbraucherrechte und Beschwerden",
          "Tüketici hakları ve başvurular",
        ),
        c(
          "Mandatory rights remain unaffected. A voluntary refund policy does not replace statutory withdrawal or conformity rights. For future consumer sales, withdrawal information and any express request for early digital delivery must be provided before purchase. Product or account questions can be sent to the contact address above.",
          "Zwingende Rechte bleiben unberührt. Eine freiwillige Erstattungsregel ersetzt keine gesetzlichen Widerrufs- oder Mängelrechte. Bei künftigen Verbraucherkäufen müssen Widerrufsinformationen und gegebenenfalls die ausdrückliche Zustimmung zur vorzeitigen digitalen Lieferung vorliegen. Fragen richten Sie an die obige Kontaktadresse.",
          "Emredici haklar saklıdır. Gönüllü iade politikası yasal cayma veya uygunluk haklarının yerine geçmez. Gelecekte tüketiciye satışta cayma bilgisi ve gerekiyorsa erken dijital teslimat için açık onay satın almadan önce sunulmalıdır. Ürün veya hesap başvurularını yukarıdaki iletişim adresine iletebilirsiniz.",
        ),
      ),
      section(
        c("Reviews", "Bewertungen", "Değerlendirmeler"),
        c(
          "Reviews are moderated before publication. Unless explicitly stated otherwise, we do not verify purchases or independently verify product use. Moderation is not purchase verification. Preview feedback must be identified as such and must not be presented as a verified purchase.",
          "Bewertungen werden vor Veröffentlichung moderiert. Soweit nicht ausdrücklich anders angegeben, prüfen wir weder einen Kauf noch die Produktnutzung unabhängig. Moderation ist keine Kaufverifizierung. Vorschau-Feedback ist als solches zu kennzeichnen.",
          "Değerlendirmeler yayımlanmadan önce denetlenir. Aksi açıkça belirtilmedikçe satın alma veya gerçek ürün kullanımını bağımsız olarak doğrulamıyoruz. Moderasyon satın alma doğrulaması değildir. Önizleme geri bildirimi bu şekilde belirtilmeli, doğrulanmış satın alma gibi sunulmamalıdır.",
        ),
      ),
      section(c("Trademarks", "Marken", "Markalar"), trademarkNote(l)),
    ];
  if (slug === "cookies")
    return [
      section(
        c(
          "Essential account storage",
          "Erforderliche Kontospeicherung",
          "Gerekli hesap depolaması",
        ),
        c(
          "Signing in uses Better Auth session cookies. Remember me changes session persistence. A private administrator entry may also set a short-lived, HttpOnly entry cookie. These provide the requested account service; they are not marketing consent.",
          "Die Anmeldung verwendet Better-Auth-Sitzungscookies. Angemeldet bleiben beeinflusst die Speicherdauer. Ein privater Administratorzugang kann zusätzlich ein kurzlebiges HttpOnly-Zugangscookie setzen. Diese dienen der angeforderten Kontofunktion und sind keine Werbeeinwilligung.",
          "Girişte Better Auth oturum çerezleri kullanılır. Beni hatırla seçimi oturum kalıcılığını etkiler. Özel yönetici girişinde kısa ömürlü HttpOnly giriş çerezi de kullanılabilir. Bunlar istenen hesap hizmetini sağlar; pazarlama izni anlamına gelmez.",
        ),
      ),
      section(
        c(
          "Session and local storage",
          "Sitzungs- und lokale Speicherung",
          "Oturum ve yerel depolama",
        ),
        c(
          "Session storage may hold the email awaiting verification, a one-time account notice and whether panel help was shown. Product filters work within the page. Blog comments and reviews are submitted to the server database, not stored only in your browser. Fonts are served from this website.",
          "Session Storage kann die zur Bestätigung vorgesehene E-Mail, einen einmaligen Kontohinweis und den Status der Panel-Hilfe speichern. Produktfilter arbeiten auf der Seite. Kommentare und Bewertungen werden in der Serverdatenbank gespeichert, nicht nur im Browser. Schriften werden von dieser Website ausgeliefert.",
          "Session storage doğrulama bekleyen e-postayı, tek seferlik hesap bildirimini ve panel yardımının gösterilip gösterilmediğini tutabilir. Ürün filtreleri sayfa içinde çalışır. Blog yorumları ve değerlendirmeler yalnız tarayıcıda değil sunucu veritabanında saklanır. Fontlar bu siteden sunulur.",
        ),
      ),
      section(
        c("External verification", "Externe Prüfung", "Harici doğrulama"),
        c(
          "Product-review submission uses Google reCAPTCHA when configured. Its script is requested when submitting a review, rather than on initial page load. Google may process network and device information. The review form links Google's privacy policy and terms. No advertising or cross-site analytics service is included in the current site implementation.",
          "Bei Bewertungsabgabe wird, sofern eingerichtet, Google reCAPTCHA verwendet. Das Skript wird erst beim Absenden angefordert. Google kann Netzwerk- und Gerätedaten verarbeiten. Das Formular verlinkt Googles Datenschutz und Bedingungen. Die aktuelle Website enthält keinen Werbe- oder websiteübergreifenden Analysedienst.",
          "Yapılandırılmışsa ürün değerlendirmesi gönderiminde Google reCAPTCHA kullanılır. Betik ilk sayfa açılışında değil, gönderim sırasında istenir. Google ağ ve cihaz bilgilerini işleyebilir. Formda Google gizlilik ve koşul bağlantıları bulunur. Mevcut site uygulamasında reklam veya siteler arası analiz hizmeti yoktur.",
        ),
      ),
      section(
        c("Your controls", "Ihre Möglichkeiten", "Kontrolleriniz"),
        c(
          "You can delete cookies and website storage in your browser; this may sign you out. We must reassess consent before introducing non-essential storage or additional third-party tools. Further information about recipients and retention is in the privacy policy.",
          "Cookies und Websitedaten können im Browser gelöscht werden; dies kann Sie abmelden. Vor Einführung nicht erforderlicher Speicherung oder weiterer Drittdienste prüfen wir die Einwilligung erneut. Empfänger und Speicherdauer stehen in der Datenschutzerklärung.",
          "Çerezleri ve site depolamasını tarayıcınızdan silebilirsiniz; oturumunuz kapanabilir. Gerekli olmayan depolama veya yeni üçüncü taraf araçlar eklenmeden önce izin gereksinimi yeniden değerlendirilmelidir. Alıcılar ve saklama bilgileri gizlilik politikasındadır.",
        ),
      ),
    ];
  return [
    identity,
    section(
      c("Optional Google sign-in", "Optionale Google-Anmeldung", "İsteğe bağlı Google ile giriş"),
      c(
        "When Google sign-in is enabled and you choose it, you are redirected to Google for authentication. We receive your Google account identifier, name, verified email and, if provided, profile picture; authentication records are stored to maintain your account. We do not receive your Google password or request Gmail or Drive access. A displayed Google profile picture may be loaded from Google's servers. Google's own processing and any international transfers must also be considered in the provider information below. Email/password registration remains an alternative.",
        "Wenn die Google-Anmeldung aktiviert ist und Sie sie wählen, werden Sie zur Authentifizierung zu Google weitergeleitet. Wir erhalten Google-Kontokennung, Name, bestätigte E-Mail und gegebenenfalls Profilbild; Anmeldedaten dienen Ihrem Konto. Wir erhalten kein Google-Passwort und fordern keinen Gmail- oder Drive-Zugriff an. Ein angezeigtes Google-Profilbild kann von Google-Servern geladen werden. Googles eigene Verarbeitung und mögliche internationale Übermittlungen sind in den nachstehenden Anbieterangaben zu berücksichtigen. E-Mail/Passwort bleibt eine Alternative.",
        "Google ile giriş etkinleştirildiğinde ve siz seçtiğinizde kimlik doğrulama için Google'a yönlendirilirsiniz. Google hesap kimliği, ad, doğrulanmış e-posta ve varsa profil resmi alınır; hesabınızı sürdürmek için kimlik doğrulama kayıtları saklanır. Google parolanızı almayız; Gmail veya Drive erişimi istemeyiz. Gösterilen Google profil resmi Google sunucularından yüklenebilir. Google'ın kendi veri işlemesi ve olası yurt dışı aktarımlar aşağıdaki sağlayıcı bilgilerinde de değerlendirilmelidir. E-posta/parola ile kayıt alternatif olarak sunulur.",
      ),
    ),
    section(
      c(
        "Hosting and security",
        "Hosting und Sicherheit",
        "Barındırma ve güvenlik",
      ),
      s.hostDetails || pending,
      c(
        "Technical request and security information may include IP address, time, URL and browser information. It is used to deliver and protect the service. Hosting and security processing requires an identified legal basis and retention schedule.",
        "Technische Anfrage- und Sicherheitsdaten können IP-Adresse, Zeit, URL und Browserdaten umfassen. Sie dienen Auslieferung und Schutz des Dienstes. Rechtsgrundlage und Speicherdauer sind dafür festzulegen.",
        "Teknik istek ve güvenlik bilgileri IP adresi, zaman, URL ve tarayıcı bilgilerini içerebilir. Hizmetin sunulması ve korunması için kullanılır. Bu işlemlerin hukuki dayanağı ve saklama süresi belirlenmelidir.",
      ),
    ),
    section(
      c(
        "Accounts and contact requests",
        "Konten und Kontaktanfragen",
        "Hesaplar ve iletişim talepleri",
      ),
      c(
        "Accounts store name, email, authentication records and the accepted terms/privacy versions and time. Sessions can store IP address and user agent. Contact requests store the details you submit. These are used for account services, responding to requests and security, on the applicable contractual, pre-contractual or legitimate-interest basis. Transactional emails are sent through Plunk; they do not subscribe you to marketing.",
        "Konten speichern Name, E-Mail, Authentifizierungsdaten sowie Version und Zeitpunkt der akzeptierten Bedingungen/Datenschutzinformation. Sitzungen können IP und User-Agent enthalten. Kontaktanfragen speichern Ihre Angaben. Die Verarbeitung dient Kontofunktionen, Antworten und Sicherheit auf einschlägiger vertraglicher, vorvertraglicher oder berechtigter Interessenbasis. Transaktionsmails laufen über Plunk und begründen kein Marketingabo.",
        "Hesaplarda ad, e-posta, kimlik doğrulama kayıtları, kabul edilen koşul/gizlilik sürümleri ve zaman saklanır. Oturumlar IP ve tarayıcı bilgisini içerebilir. İletişim taleplerinde gönderdiğiniz bilgiler saklanır. Hesap hizmetleri, taleplere yanıt ve güvenlik için geçerli sözleşme, sözleşme öncesi işlem veya meşru menfaat dayanağı değerlendirilir. İşlem e-postaları Plunk üzerinden gider; pazarlama aboneliği oluşturmaz.",
      ),
    ),
    section(
      c(
        "Comments, reviews and AI moderation",
        "Kommentare, Bewertungen und KI-Moderation",
        "Yorumlar, değerlendirmeler ve AI moderasyonu",
      ),
      c(
        "Comments and reviews store name, private email, content and moderation metadata. Approved names and content are public; email addresses are not published. Review submission may use Google reCAPTCHA. When OpenRouter is configured, blog comment text is sent through it to the selected model for advisory moderation. Separate name/email fields are excluded, but free text may itself contain personal data. An administrator makes the publication decision. Do not include sensitive information in public submissions.",
        "Kommentare und Bewertungen speichern Name, private E-Mail, Inhalt und Moderationsdaten. Freigegebene Namen und Inhalte sind öffentlich; E-Mails werden nicht veröffentlicht. Bewertungen können Google reCAPTCHA nutzen. Wenn OpenRouter eingerichtet ist, wird der Kommentartext zur beratenden Moderation an das gewählte Modell gesendet. Separate Namen/E-Mails sind ausgeschlossen; Freitext kann dennoch personenbezogene Daten enthalten. Über Veröffentlichung entscheidet ein Administrator. Bitte keine sensiblen Daten einreichen.",
        "Yorum ve değerlendirmelerde ad, özel e-posta, içerik ve moderasyon bilgileri saklanır. Onaylanan ad ve içerik herkese açıktır; e-posta yayımlanmaz. Değerlendirmelerde Google reCAPTCHA kullanılabilir. OpenRouter yapılandırılmışsa blog yorum metni danışma amaçlı moderasyon için seçilen modele iletilir. Ayrı ad/e-posta alanları gönderilmez; serbest metin yine de kişisel veri içerebilir. Yayımlama kararını yönetici verir. Açık gönderilere hassas bilgi eklemeyin.",
      ),
    ),
    section(
      c(
        "Newsletter and launch notifications",
        "Newsletter und Startbenachrichtigungen",
        "Bülten ve açılış bildirimleri",
      ),
      c(
        "Newsletter and reopening notifications are separate purposes. We store the submitted address/name, purpose, notice version, confirmation and withdrawal dates. Subscription requires email confirmation. Unconfirmed addresses are not eligible for campaigns. You may withdraw using the unsubscribe link; withdrawal does not affect prior lawful processing. Account emails are independent of this consent.",
        "Newsletter und Wiedereröffnungsnachrichten sind getrennte Zwecke. Gespeichert werden Adresse/Name, Zweck, Informationsversion sowie Bestätigungs- und Widerrufszeiten. Ein Abo erfordert E-Mail-Bestätigung. Unbestätigte Adressen sind nicht für Kampagnen freigegeben. Widerruf ist über den Abmeldelink möglich und berührt vorherige rechtmäßige Verarbeitung nicht. Kontomails sind davon unabhängig.",
        "Bülten ve yeniden açılış bildirimi ayrı amaçlardır. Gönderilen adres/ad, amaç, bilgilendirme sürümü, doğrulama ve geri çekme zamanları saklanır. Abonelik e-posta doğrulaması gerektirir. Doğrulanmamış adreslere kampanya gönderilmez. Abonelikten ayrılma bağlantısından izni geri çekebilirsiniz; önceki hukuka uygun işlemler etkilenmez. Hesap e-postaları bu izinden bağımsızdır.",
      ),
    ),
    section(
      c(
        "Processors and international transfers",
        "Auftragsverarbeiter und internationale Übermittlungen",
        "Veri işleyenler ve uluslararası aktarımlar",
      ),
      s.transferDetails || pending,
      c(
        "Depending on the configured features, processors include hosting/database providers, Plunk, UploadThing and OpenRouter/model providers; Google reCAPTCHA and Telegram require their own role assessment. Administrators must not submit unrelated personal data to AI or Telegram tools. Actual regions, contracts and transfer safeguards must be documented above.",
        "Je nach aktivierten Funktionen gehören Hosting/Datenbank, Plunk, UploadThing und OpenRouter/Modellanbieter zu den Dienstleistern; Google reCAPTCHA und Telegram erfordern eine gesonderte Rollenbewertung. Administratoren dürfen keine sachfremden personenbezogenen Daten an KI/Telegram übermitteln. Regionen, Verträge und Schutzmaßnahmen sind oben zu dokumentieren.",
        "Etkin özelliklere göre barındırma/veritabanı, Plunk, UploadThing ve OpenRouter/model sağlayıcıları hizmet sunar; Google reCAPTCHA ve Telegram için roller ayrıca değerlendirilmelidir. Yöneticiler ilgisiz kişisel verileri AI veya Telegram araçlarına göndermemelidir. Gerçek bölgeler, sözleşmeler ve aktarım önlemleri yukarıda belgelenmelidir.",
      ),
    ),
    section(
      c(
        "Payments and subscription records",
        "Zahlungen und Abodaten",
        "Ödeme ve abonelik kayıtları",
      ),
      c(
        "Creem processes payments as merchant of record. We store provider customer/subscription references, product and plan, subscription status and period, and the time and document versions of checkout consent. We do not store card numbers. These records support delivery, billing enquiries and service access. The secure Creem portal provides invoices and payment/cancellation controls.",
        "Creem verarbeitet Zahlungen als Merchant of Record. Wir speichern Kunden-/Aboreferenzen, Produkt und Plan, Status und Zeitraum sowie Zeitpunkt und Dokumentversionen der Checkout-Bestätigung. Kartennummern werden nicht gespeichert. Diese Daten dienen Lieferung, Abrechnungsanfragen und Servicezugriff. Das sichere Creem-Portal bietet Rechnungen und Zahlungs-/Kündigungsverwaltung.",
        "Creem ödemeleri Merchant of Record olarak işler. Sağlayıcı müşteri/abonelik referansları, ürün ve plan, abonelik durumu ve dönemi, ödeme onayının zamanı ve belge sürümleri saklanır. Kart numarası saklamayız. Kayıtlar teslimat, fatura başvuruları ve hizmet erişimi için kullanılır. Faturalar, ödeme ve iptal işlemleri güvenli Creem portalında yönetilir.",
      ),
    ),
    section(
      c(
        "Retention and backups",
        "Speicherung und Sicherungen",
        "Saklama ve yedekler",
      ),
      s.retentionDetails || pending,
      c(
        "Administrative exports can contain messages, comments, subscriber details and settings. They require restricted access and secure storage. Restores must preserve withdrawals and account records; a restored subscription is never automatically reactivated. Page statistics are daily totals by page, without visitor identifiers in that counter.",
        "Exporte können Nachrichten, Kommentare, Abonnentendaten und Einstellungen enthalten. Zugriff und Speicherung sind zu schützen. Wiederherstellungen müssen Widerrufe und Kontodaten erhalten; ein wiederhergestelltes Abo wird nie automatisch aktiviert. Seitenstatistiken sind tägliche Summen pro Seite ohne Besucherkennung in diesem Zähler.",
        "Yönetici dışa aktarımları mesajlar, yorumlar, abone bilgileri ve ayarlar içerebilir; erişimleri ve depolaması korunmalıdır. Geri yükleme izin geri çekmelerini ve hesap kayıtlarını korumalıdır; geri yüklenen abonelik otomatik etkinleştirilmez. Sayfa istatistikleri ziyaretçi kimliği içermeyen günlük sayfa toplamlarıdır.",
      ),
    ),
    section(
      c(
        "Your rights and requests",
        "Ihre Rechte und Anfragen",
        "Haklarınız ve başvurular",
      ),
      c(
        "The controller is based in Türkiye. You may exercise the applicable rights under Articles 11 and 13 of Law No. 6698 (KVKK), including requesting information, correction or deletion and objecting to unlawful processing. Where GDPR applies, its additional rights also remain available. Contact the privacy email above or the postal address. Identity is verified proportionately and mandatory retention obligations are considered. You may complain to the competent authority.",
        "Der Verantwortliche sitzt in der Türkei. Anwendbare Rechte nach Art. 11 und 13 des Gesetzes Nr. 6698 (KVKK), einschließlich Information, Berichtigung, Löschung und Widerspruch, können geltend gemacht werden. Soweit die DSGVO gilt, bleiben deren zusätzliche Rechte bestehen. Wenden Sie sich an die obige Datenschutz- oder Postadresse. Identität wird angemessen geprüft und gesetzliche Aufbewahrung wird berücksichtigt. Beschwerden bei der zuständigen Behörde bleiben möglich.",
        "Veri sorumlusu Türkiye'dedir. 6698 sayılı KVKK'nın 11. ve 13. maddeleri kapsamında işlenme bilgisi, düzeltme, koşulları oluşmuşsa silme/yok etme, aktarılan kişilere bildirim, aleyhe otomatik sonuca itiraz ve zararın giderilmesi haklarınızı kullanabilirsiniz. GDPR uygulanıyorsa ek haklarınız da saklıdır. Yukarıdaki gizlilik e-postasına veya posta adresine başvurun. Kimlik orantılı biçimde doğrulanır, zorunlu saklama yükümlülükleri dikkate alınır. Yetkili makama şikâyet hakkı saklıdır.",
      ),
      s.supervisoryAuthority || pending,
    ),
  ];
}
