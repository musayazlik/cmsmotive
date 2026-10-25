import type { Locale } from "@/lib/i18n/config";

/**
 * Everything the panel assistant says, in each system language (Settings →
 * General → System language). Topics are matched against the keywords of
 * every language, so a question typed in another language still finds its
 * answer; the reply is always in the chosen one.
 */

type Topic = { keys: Record<Locale, string[]>; reply: Record<Locale, string> };

const TOPICS: Topic[] = [
  {
    keys: {
      en: ["post", "blog", "publish", "write", "article"],
      de: ["beitrag", "blog", "veröffentlich", "schreib", "artikel"],
      tr: ["yazı", "blog", "yayınla", "yayın", "makale", "gönderi"],
    },
    reply: {
      en: "Posts live under Blog → Posts. Start a new post and the editor autosaves as a draft — you can also open Generate with AI to have the title, body, tags and cover image drafted for you before publishing.",
      de: "Beiträge findest du unter Blog → Posts. Starte einen neuen Beitrag, und der Editor speichert ihn automatisch als Entwurf — mit „Generate with AI“ lässt du Titel, Text, Tags und Titelbild vor dem Veröffentlichen entwerfen.",
      tr: "Yazılar Blog → Posts altında. Yeni bir yazı başlattığında editör onu otomatik olarak taslak kaydeder — yayınlamadan önce başlık, metin, etiketler ve kapak görselini hazırlatmak için Generate with AI'yi de açabilirsin.",
    },
  },
  {
    keys: {
      en: ["ai", "assistant", "model", "generate"],
      de: ["ki", "assistent", "modell", "generier"],
      tr: ["yapay zeka", "yapay zekâ", "asistan", "model", "oluştur", "üret"],
    },
    reply: {
      en: "The AI tools are under Blog → Generate with AI and Settings → AI. Pick your text and image models there, then drafts, covers, tags and even web research are one click away. Generated content is always saved as a draft first.",
      de: "Die KI-Werkzeuge findest du unter Blog → Generate with AI und Settings → AI. Wähle dort deine Text- und Bildmodelle, dann sind Entwürfe, Titelbilder, Tags und sogar Webrecherche nur einen Klick entfernt. Erzeugte Inhalte werden immer zuerst als Entwurf gespeichert.",
      tr: "Yapay zekâ araçları Blog → Generate with AI ve Settings → AI altında. Metin ve görsel modellerini orada seç; taslaklar, kapak görselleri, etiketler, hatta web araştırması tek tık uzaklıkta. Üretilen içerik her zaman önce taslak olarak kaydedilir.",
    },
  },
  {
    keys: {
      en: ["product", "theme", "template", "catalogue", "catalog"],
      de: ["produkt", "theme", "vorlage", "katalog"],
      tr: ["ürün", "tema", "şablon", "katalog"],
    },
    reply: {
      en: "Everything you sell lives under Products: the Catalogue lists every product with its content and media, Types defines the kinds (theme, extension, …), and each product's edit page has Pricing and Releases tabs.",
      de: "Alles, was du verkaufst, findest du unter Products: Der Katalog listet jedes Produkt mit Inhalt und Medien, Types legt die Arten fest (Theme, Extension, …), und die Bearbeitungsseite jedes Produkts hat die Reiter Pricing und Releases.",
      tr: "Sattığın her şey Products altında: Catalogue tüm ürünleri içeriği ve medyasıyla listeler, Types türleri tanımlar (tema, eklenti, …); her ürünün düzenleme sayfasında Pricing ve Releases sekmeleri vardır.",
    },
  },
  {
    keys: {
      en: ["media", "image", "upload", "file", "photo"],
      de: ["medien", "bild", "hochlad", "upload", "datei", "foto"],
      tr: ["medya", "görsel", "resim", "yükle", "dosya", "fotoğraf"],
    },
    reply: {
      en: "The Media library keeps every upload in one place. Drag files straight onto the page or add them from any editor — images are optimized automatically and reusable across posts and products.",
      de: "Die Media library bündelt alle Uploads an einem Ort. Ziehe Dateien direkt auf die Seite oder füge sie aus jedem Editor hinzu — Bilder werden automatisch optimiert und lassen sich in Beiträgen und Produkten wiederverwenden.",
      tr: "Media library tüm yüklemeleri tek bir yerde tutar. Dosyaları doğrudan sayfaya sürükle ya da herhangi bir editörden ekle — görseller otomatik olarak optimize edilir ve yazılarda ve ürünlerde yeniden kullanılabilir.",
    },
  },
  {
    keys: {
      en: ["review", "rating", "approve"],
      de: ["bewertung", "rezension", "freigeb"],
      tr: ["yorum", "değerlendirme", "puan", "onay"],
    },
    reply: {
      en: "Customer reviews land in the Reviews screen. Approve or reject them one by one; the sidebar badge counts the ones still waiting for you.",
      de: "Kundenbewertungen landen im Bereich Reviews. Gib sie einzeln frei oder lehne sie ab; das Badge in der Seitenleiste zählt die, die noch auf dich warten.",
      tr: "Müşteri yorumları Reviews ekranına düşer. Onları tek tek onayla ya da reddet; kenar çubuğundaki rozet hâlâ seni bekleyenleri sayar.",
    },
  },
  {
    keys: {
      en: ["user", "account", "password", "profile", "role", "email", "mail"],
      de: ["benutzer", "konto", "passwort", "profil", "rolle", "mail"],
      tr: ["kullanıcı", "hesap", "şifre", "parola", "profil", "rol", "posta"],
    },
    reply: {
      en: "Workspace members are managed under Users. Your own profile, email and password live under My account at the bottom of the sidebar.",
      de: "Mitglieder des Workspace verwaltest du unter Users. Dein eigenes Profil, deine E-Mail und dein Passwort findest du unter My account unten in der Seitenleiste.",
      tr: "Çalışma alanı üyeleri Users altında yönetilir. Kendi profilin, e-postan ve şifren kenar çubuğunun altındaki My account bölümünde.",
    },
  },
  {
    keys: {
      en: ["inbox", "message", "contact", "telegram"],
      de: ["posteingang", "nachricht", "kontakt", "telegram"],
      tr: ["gelen kutusu", "mesaj", "iletişim", "telegram"],
    },
    reply: {
      en: "Contact messages arrive in the Inbox — unread ones are badges in the sidebar. Telegram is linked from Settings if you also want notifications and chats forwarded to the bot.",
      de: "Kontaktnachrichten kommen im Inbox an — ungelesene erscheinen als Badge in der Seitenleiste. Telegram verbindest du unter Settings, wenn auch Benachrichtigungen und Chats an den Bot gehen sollen.",
      tr: "İletişim mesajları Inbox'a gelir — okunmamış olanlar kenar çubuğunda rozet olarak görünür. Bildirimlerin ve sohbetlerin bota da iletilmesini istersen Telegram'ı Settings'ten bağlayabilirsin.",
    },
  },
];

const FALLBACK: Record<Locale, string> = {
  en: "I can help with products, posts, media, users, reviews and the AI features. Which one would you like to explore? Anything beyond that, I'll point you to the contact form.",
  de: "Ich helfe dir bei Produkten, Beiträgen, Medien, Benutzern, Bewertungen und den KI-Funktionen. Womit möchtest du anfangen? Für alles Weitere verweise ich dich auf das Kontaktformular.",
  tr: "Ürünler, yazılar, medya, kullanıcılar, yorumlar ve yapay zekâ özellikleri konusunda yardımcı olabilirim. Hangisine bakmak istersin? Bunların dışındaki konular için seni iletişim formuna yönlendiririm.",
};

/**
 * The message lowercased both the usual and the Turkish way ("AI" → "ai",
 * "İLETİŞİM" → "iletişim"), each split into words; either form may match.
 */
function wordForms(text: string): string[][] {
  return [text.toLowerCase(), text.toLocaleLowerCase("tr")].map((lower) => lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

/**
 * The reply to a message in `language`. A keyword matches the start of a
 * word ("publish" in "publishing"), so short keys such as "ai" do not fire
 * inside other words ("email"); keys with a space match the phrase.
 */
export function assistantReply(text: string, language: Locale): string {
  const forms = wordForms(text);
  for (const topic of TOPICS) {
    const hit = Object.values(topic.keys)
      .flat()
      .some((key) =>
        forms.some((tokens) => (key.includes(" ") ? tokens.join(" ").includes(key) : tokens.some((token) => token.startsWith(key)))),
      );
    if (hit) return topic.reply[language];
  }
  return FALLBACK[language];
}

export type ChatCopy = {
  greeting: (firstName: string) => string;
  quickPrompts: string[];
  cloudTitle: string;
  cloudText: string;
  openChat: string;
  dismissCloud: string;
  dialog: string;
  eyebrow: string;
  closeChat: string;
  name: string;
  status: string;
  typing: string;
  suggestions: string;
  placeholder: string;
  messageLabel: string;
  send: string;
  launchOpen: string;
  launchClose: string;
};

export const CHAT_COPY: Record<Locale, ChatCopy> = {
  en: {
    greeting: (firstName) =>
      `Hi ${firstName}! 👋 I'm the CMSMotive assistant. Ask me about products, posts, media, the AI tools — or anything else around the panel.`,
    quickPrompts: ["Publishing a post", "What can the AI do?", "Managing products"],
    cloudTitle: "Need a hand?",
    cloudText: "I can show you around the panel.",
    openChat: "Open the support chat",
    dismissCloud: "Dismiss the help bubble",
    dialog: "Support chat",
    eyebrow: "SUPPORT / ASSISTANT",
    closeChat: "Close the chat",
    name: "CMSMotive Assistant",
    status: "Online — replies instantly",
    typing: "The assistant is typing",
    suggestions: "Suggested questions",
    placeholder: "Type a message…",
    messageLabel: "Message for the assistant",
    send: "Send the message",
    launchOpen: "Open the support chat",
    launchClose: "Close the support chat",
  },
  de: {
    greeting: (firstName) =>
      `Hallo ${firstName}! 👋 Ich bin der CMSMotive-Assistent. Frag mich zu Produkten, Beiträgen, Medien, den KI-Werkzeugen — oder zu allem anderen rund ums Panel.`,
    quickPrompts: ["Einen Beitrag veröffentlichen", "Was kann die KI?", "Produkte verwalten"],
    cloudTitle: "Brauchst du Hilfe?",
    cloudText: "Ich zeige dir das Panel.",
    openChat: "Support-Chat öffnen",
    dismissCloud: "Hilfeblase schließen",
    dialog: "Support-Chat",
    eyebrow: "SUPPORT / ASSISTENT",
    closeChat: "Chat schließen",
    name: "CMSMotive-Assistent",
    status: "Online — antwortet sofort",
    typing: "Der Assistent schreibt",
    suggestions: "Vorgeschlagene Fragen",
    placeholder: "Nachricht eingeben…",
    messageLabel: "Nachricht an den Assistenten",
    send: "Nachricht senden",
    launchOpen: "Support-Chat öffnen",
    launchClose: "Support-Chat schließen",
  },
  tr: {
    greeting: (firstName) =>
      `Merhaba ${firstName}! 👋 Ben CMSMotive asistanıyım. Bana ürünler, yazılar, medya, yapay zekâ araçları — ya da panelle ilgili başka herhangi bir şey hakkında soru sorabilirsin.`,
    quickPrompts: ["Yazı yayınlama", "Yapay zekâ neler yapabilir?", "Ürün yönetimi"],
    cloudTitle: "Yardım ister misin?",
    cloudText: "Sana paneli gezdirebilirim.",
    openChat: "Destek sohbetini aç",
    dismissCloud: "Yardım balonunu kapat",
    dialog: "Destek sohbeti",
    eyebrow: "DESTEK / ASİSTAN",
    closeChat: "Sohbeti kapat",
    name: "CMSMotive Asistanı",
    status: "Çevrimiçi — anında yanıt verir",
    typing: "Asistan yazıyor",
    suggestions: "Önerilen sorular",
    placeholder: "Bir mesaj yaz…",
    messageLabel: "Asistana mesaj",
    send: "Mesajı gönder",
    launchOpen: "Destek sohbetini aç",
    launchClose: "Destek sohbetini kapat",
  },
};
