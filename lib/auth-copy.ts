import type { Locale } from "./i18n/config";
const strings: Record<string, [string, string]> = {
  "Google sign-in could not be completed. Try again or use your email address.": ["Google-Anmeldung konnte nicht abgeschlossen werden. Versuchen Sie es erneut oder verwenden Sie Ihre E-Mail-Adresse.","Google ile giriş tamamlanamadı. Yeniden deneyin veya e-posta adresinizi kullanın."],
  "Current password": ["Aktuelles Passwort", "Mevcut parola"],
  "Repeat new password": ["Neues Passwort wiederholen", "Yeni parolayı tekrar girin"],
  "Update password": ["Passwort ändern", "Parolayı güncelle"],
  "Updating…": ["Wird geändert…", "Güncelleniyor…"],
  "Password updated.": ["Passwort geändert.", "Parola güncellendi."],
  "Changing the password signs out your other devices; this session stays active.": ["Die Passwortänderung meldet Ihre anderen Geräte ab; diese Sitzung bleibt aktiv.", "Parola değişikliği diğer cihazlardaki oturumlarınızı kapatır; bu oturum açık kalır."],
  "The new password must be at least 8 characters.": ["Das neue Passwort muss mindestens 8 Zeichen lang sein.", "Yeni parola en az 8 karakter olmalıdır."],
  "The new passwords do not match.": ["Die neuen Passwörter stimmen nicht überein.", "Yeni parolalar aynı değil."],
  "The new password must be different from the current one.": ["Das neue Passwort muss sich vom aktuellen unterscheiden.", "Yeni parola mevcut paroladan farklı olmalıdır."],
  "The current password is incorrect.": ["Das aktuelle Passwort ist falsch.", "Mevcut parola yanlış."],
  "The password could not be changed.": ["Das Passwort konnte nicht geändert werden.", "Parola değiştirilemedi."],
  "Could not reach the server.": ["Der Server ist nicht erreichbar.", "Sunucuya ulaşılamadı."],
  "A quieter place for the tools, themes and ideas behind your next TYPO3 build.":
    [
      "Ein ruhiger Ort für die Werkzeuge, Themes und Ideen Ihres nächsten TYPO3-Projekts.",
      "Bir sonraki TYPO3 projenizin araçları, temaları ve fikirleri için sakin bir alan.",
    ],
  "The right foundations give every new idea more room to become something useful.":
    [
      "Die richtige Grundlage gibt jeder Idee Raum, etwas Nützliches zu werden.",
      "Doğru bir temel, her yeni fikrin yararlı bir ürüne dönüşmesine yer açar.",
    ],
  "The details make the difference.": [
    "Die Details machen den Unterschied.",
    "Farkı ayrıntılar yaratır.",
  ],
  "A clear path back to your workspace, built with the same care as the products inside it.":
    [
      "Ein klarer Weg zurück zu Ihrem Konto, mit derselben Sorgfalt wie unsere Produkte.",
      "Ürünlerimizle aynı özenle hazırlanmış, hesabınıza açık bir dönüş yolu.",
    ],
  "Pick up right where you left off.": [
    "Machen Sie dort weiter, wo Sie aufgehört haben.",
    "Kaldığınız yerden devam edin.",
  ],
  "Your projects and resources should always be easy to return to.": [
    "Ihre Projekte und Ressourcen sollten jederzeit leicht erreichbar sein.",
    "Projelerinize ve kaynaklarınıza her zaman kolayca ulaşın.",
  ],
  "From idea to implementation.": [
    "Von der Idee zur Umsetzung.",
    "Fikirden uygulamaya.",
  ],
  "Everything works better when the path forward feels clear from the start.": [
    "Alles funktioniert besser, wenn der nächste Schritt von Anfang an klar ist.",
    "İzlenecek yol baştan açık olduğunda her şey daha iyi işler.",
  ],
  "Welcome back.": ["Willkommen zurück.", "Tekrar hoş geldiniz."],
  "Sign in to your CMSMotive account.": [
    "Melden Sie sich bei Ihrem CMSMotive-Konto an.",
    "CMSMotive hesabınıza giriş yapın.",
  ],
  "Create your account.": ["Konto erstellen.", "Hesabınızı oluşturun."],
  "Manage your products and account in one place.": [
    "Verwalten Sie Produkte und Konto an einem Ort.",
    "Ürünlerinizi ve hesabınızı tek yerden yönetin.",
  ],
  "Forgot your password?": ["Passwort vergessen?", "Parolanızı mı unuttunuz?"],
  "Set a new password.": [
    "Neues Passwort festlegen.",
    "Yeni parola belirleyin.",
  ],
  "Confirm your email.": ["E-Mail bestätigen.", "E-postanızı doğrulayın."],
  "Enter your email address to request a password reset link.": [
    "Geben Sie Ihre E-Mail-Adresse für einen Link zum Zurücksetzen ein.",
    "Parola yenileme bağlantısı için e-posta adresinizi girin.",
  ],
  "Choose a new password for your CMSMotive account.": [
    "Wählen Sie ein neues Passwort für Ihr CMSMotive-Konto.",
    "CMSMotive hesabınız için yeni parola seçin.",
  ],
  "Confirm your address to activate your account.": [
    "Bestätigen Sie Ihre Adresse, um Ihr Konto zu aktivieren.",
    "Hesabınızı etkinleştirmek için adresinizi doğrulayın.",
  ],
  "Email address": ["E-Mail-Adresse", "E-posta adresi"],
  "Work email": ["Geschäftliche E-Mail", "E-posta"],
  "Full name": ["Vollständiger Name", "Ad soyad"],
  "Your name": ["Ihr Name", "Adınız"],
  Password: ["Passwort", "Parola"],
  "New password": ["Neues Passwort", "Yeni parola"],
  "Confirm new password": [
    "Neues Passwort bestätigen",
    "Yeni parolayı doğrulayın",
  ],
  "Enter your password": ["Passwort eingeben", "Parolanızı girin"],
  "Create a password": ["Passwort erstellen", "Parola oluşturun"],
  "Create a new password": [
    "Neues Passwort erstellen",
    "Yeni parola oluşturun",
  ],
  "Repeat your new password": [
    "Neues Passwort wiederholen",
    "Yeni parolayı tekrar girin",
  ],
  "Use at least 8 characters.": [
    "Mindestens 8 Zeichen verwenden.",
    "En az 8 karakter kullanın.",
  ],
  "Use at least 8 characters. Both passwords must match.": [
    "Mindestens 8 Zeichen. Beide Passwörter müssen übereinstimmen.",
    "En az 8 karakter kullanın. İki parola aynı olmalıdır.",
  ],
  "Sign in": ["Anmelden", "Giriş yap"],
  "Create account": ["Konto erstellen", "Hesap oluştur"],
  "Create an account": ["Konto erstellen", "Hesap oluştur"],
  "Request reset link": ["Link anfordern", "Yenileme bağlantısı iste"],
  "Set new password": ["Passwort speichern", "Parolayı kaydet"],
  "Resend verification email": [
    "Bestätigung erneut senden",
    "Doğrulama e-postasını yeniden gönder",
  ],
  "Remember me": ["Angemeldet bleiben", "Beni hatırla"],
  "Back to site": ["Zur Website", "Siteye dön"],
  "Skip to content": ["Zum Inhalt springen", "İçeriğe geç"],
  Privacy: ["Datenschutz", "Gizlilik"],
  Terms: ["Bedingungen", "Koşullar"],
  Imprint: ["Impressum", "Yasal bilgiler"],
  Help: ["Hilfe", "Yardım"],
  "New to CMSMotive?": ["Neu bei CMSMotive?", "CMSMotive'e yeni misiniz?"],
  "Already have an account?": ["Bereits ein Konto?", "Zaten hesabınız var mı?"],
  "Remembered your password?": [
    "Passwort wieder eingefallen?",
    "Parolanızı hatırladınız mı?",
  ],
  "Back to sign in": ["Zur Anmeldung", "Girişe dön"],
  "Need a new reset link?": [
    "Neuen Link anfordern?",
    "Yeni bağlantı mı gerekiyor?",
  ],
  "Request one": ["Link anfordern", "Bağlantı iste"],
  "Wrong address?": ["Falsche Adresse?", "Yanlış adres mi?"],
  "Check your inbox": ["Posteingang prüfen", "Gelen kutunuzu kontrol edin"],
  "Verify your address": ["Adresse bestätigen", "Adresinizi doğrulayın"],
  "If a verification message was requested, check {email}. You can request another message below.":
    [
      "Wenn eine Bestätigung angefordert wurde, prüfen Sie {email}. Unten können Sie eine neue Nachricht anfordern.",
      "Doğrulama istediyseniz {email} adresini kontrol edin. Aşağıdan yeniden isteyebilirsiniz.",
    ],
  "Open the confirmation link in your email. If you need another message, return to sign in and enter your email.":
    [
      "Öffnen Sie den Link in Ihrer E-Mail. Für eine neue Nachricht melden Sie sich mit Ihrer E-Mail-Adresse an.",
      "E-postanızdaki doğrulama bağlantısını açın. Yeni mesaj gerekiyorsa giriş ekranında e-posta adresinizi kullanın.",
    ],
  "We’ll send a secure reset link if an account exists for this address.": [
    "Falls ein Konto existiert, senden wir einen sicheren Link.",
    "Bu adres için hesap varsa güvenli bir yenileme bağlantısı göndereceğiz.",
  ],
  "Your password has been updated. You can sign in now.": [
    "Ihr Passwort wurde geändert. Sie können sich anmelden.",
    "Parolanız güncellendi. Giriş yapabilirsiniz.",
  ],
  "This reset link is invalid or expired. Request a new one.": [
    "Dieser Link ist ungültig oder abgelaufen. Fordern Sie einen neuen an.",
    "Bağlantı geçersiz veya süresi dolmuş. Yenisini isteyin.",
  ],
  "Open the link in your reset email to choose a new password.": [
    "Öffnen Sie den Link in der E-Mail, um ein neues Passwort zu wählen.",
    "Yeni parola seçmek için e-postanızdaki bağlantıyı açın.",
  ],
  "Passwords do not match.": [
    "Die Passwörter stimmen nicht überein.",
    "Parolalar aynı değil.",
  ],
  "If an account exists for that address, a reset link is on its way.": [
    "Falls ein Konto existiert, wird ein Link gesendet.",
    "Bu adres için hesap varsa yenileme bağlantısı gönderilir.",
  ],
  "A new verification link has been sent.": [
    "Ein neuer Bestätigungslink wurde gesendet.",
    "Yeni doğrulama bağlantısı gönderildi.",
  ],
  "Signing in…": ["Anmeldung…", "Giriş yapılıyor…"],
  "Creating account…": ["Konto wird erstellt…", "Hesap oluşturuluyor…"],
  "Sending reset link…": ["Link wird gesendet…", "Bağlantı gönderiliyor…"],
  "Updating password…": ["Passwort wird geändert…", "Parola güncelleniyor…"],
  "Sending verification…": [
    "Bestätigung wird gesendet…",
    "Doğrulama gönderiliyor…",
  ],
  "I accept the account terms.": [
    "Ich akzeptiere die Kontobedingungen.",
    "Hesap koşullarını kabul ediyorum.",
  ],
  "Read how we process your data in the privacy policy.": [
    "Informationen zur Datenverarbeitung finden Sie in der Datenschutzerklärung.",
    "Verilerinizin nasıl işlendiğini gizlilik politikasından okuyabilirsiniz.",
  ],
  "Show password": ["Passwort anzeigen", "Parolayı göster"],
  "Hide password": ["Passwort verbergen", "Parolayı gizle"],
  "Good work starts with a good foundation.": [
    "Gute Arbeit beginnt mit einer guten Grundlage.",
    "İyi iş, sağlam bir temelle başlar.",
  ],
  "Build with intention. Grow with clarity.": [
    "Bewusst gestalten. Klar wachsen.",
    "Amaçla tasarlayın. Netlikle büyüyün.",
  ],
};
export function authText(
  locale: Locale,
  key: string,
  vars?: Record<string, string>,
) {
  let text =
    locale === "en" ? key : (strings[key]?.[locale === "de" ? 0 : 1] ?? key);
  for (const [k, v] of Object.entries(vars ?? {}))
    text = text.replaceAll(`{${k}}`, v);
  return text;
}
