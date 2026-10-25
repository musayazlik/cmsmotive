import type { Locale } from "@/lib/i18n/config";

export type ChatCopy = {
  greeting: (firstName: string) => string;
  quickPrompts: string[];
  cloudTitle: string;
  cloudText: string;
  openChat: string;
  dismissCloud: string;
  dialog: string;
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
  retry: string;
  disclaimer: string;
  errors: Record<string, string>;
};

export const CHAT_COPY: Record<Locale, ChatCopy> = {
  en: {
    greeting: (firstName) =>
      `Hi ${firstName}! I’m the CMSMotive AI assistant. How can I help?`,
    quickPrompts: ["Publishing a post", "What can the AI do?", "Managing products"],
    cloudTitle: "Need a hand?",
    cloudText: "I can show you around the panel.",
    openChat: "Open the support chat",
    dismissCloud: "Dismiss the help bubble",
    dialog: "Support chat",
    closeChat: "Close the chat",
    name: "CMSMotive Assistant",
    status: "AI assistant",
    typing: "The assistant is typing",
    suggestions: "Suggested questions",
    placeholder: "Type a message…",
    messageLabel: "Message for the assistant",
    send: "Send the message",
    launchOpen: "Open the support chat",
    launchClose: "Close the support chat",
    retry: "Try again",
    disclaimer: "AI can make mistakes. Check important details.",
    errors: {
      not_configured: "The AI connection is not configured or was refused. Check OPENROUTER_API_KEY in the server environment and Settings → AI.",
      unauthorized: "Your session has expired. Sign in again.",
      unavailable: "Couldn’t get a response. Please try again.",
    },
  },
  de: {
    greeting: (firstName) =>
      `Hallo ${firstName}! Ich bin dein CMSMotive-KI-Assistent. Wie kann ich helfen?`,
    quickPrompts: ["Einen Beitrag veröffentlichen", "Was kann die KI?", "Produkte verwalten"],
    cloudTitle: "Brauchst du Hilfe?",
    cloudText: "Ich zeige dir das Panel.",
    openChat: "Support-Chat öffnen",
    dismissCloud: "Hilfeblase schließen",
    dialog: "Support-Chat",
    closeChat: "Chat schließen",
    name: "CMSMotive-Assistent",
    status: "KI-Assistent",
    typing: "Der Assistent schreibt",
    suggestions: "Vorgeschlagene Fragen",
    placeholder: "Nachricht eingeben…",
    messageLabel: "Nachricht an den Assistenten",
    send: "Nachricht senden",
    launchOpen: "Support-Chat öffnen",
    launchClose: "Support-Chat schließen",
    retry: "Erneut versuchen",
    disclaimer: "KI kann Fehler machen. Prüfe wichtige Angaben.",
    errors: {
      not_configured: "Die KI-Verbindung ist nicht eingerichtet oder wurde abgelehnt. Prüfe OPENROUTER_API_KEY in der Serverumgebung und Settings → AI.",
      unauthorized: "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
      unavailable: "Keine Antwort erhalten. Bitte versuche es erneut.",
    },
  },
  tr: {
    greeting: (firstName) =>
      `Merhaba ${firstName}! Ben CMSMotive yapay zekâ asistanıyım. Nasıl yardımcı olabilirim?`,
    quickPrompts: ["Yazı yayınlama", "Yapay zekâ neler yapabilir?", "Ürün yönetimi"],
    cloudTitle: "Yardım ister misin?",
    cloudText: "Sana paneli gezdirebilirim.",
    openChat: "Destek sohbetini aç",
    dismissCloud: "Yardım balonunu kapat",
    dialog: "Destek sohbeti",
    closeChat: "Sohbeti kapat",
    name: "CMSMotive Asistanı",
    status: "Yapay zekâ asistanı",
    typing: "Asistan yazıyor",
    suggestions: "Önerilen sorular",
    placeholder: "Bir mesaj yaz…",
    messageLabel: "Asistana mesaj",
    send: "Mesajı gönder",
    launchOpen: "Destek sohbetini aç",
    launchClose: "Destek sohbetini kapat",
    retry: "Tekrar dene",
    disclaimer: "Yapay zekâ hata yapabilir. Önemli bilgileri doğrula.",
    errors: {
      not_configured: "Yapay zekâ bağlantısı yapılandırılmamış veya reddedildi. Sunucu ortamındaki OPENROUTER_API_KEY anahtarını ve Settings → AI sayfasını kontrol et.",
      unauthorized: "Oturumun sona erdi. Tekrar giriş yap.",
      unavailable: "Yanıt alınamadı. Lütfen tekrar dene.",
    },
  },
};
