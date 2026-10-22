# CMSMotive

Next.js App Router uygulaması. Mevcut sayfalar `static-site/` altında kaynak HTML olarak durur; Next.js bu sayfaları uzantısız URL'lerde sunar. Görseller, CSS ve tarayıcı betikleri `public/assets/` altında yayınlanır. `/panel` Next.js ile oluşturulmuş, sunucu tarafında oturum kontrolü yapan hesap alanıdır.

## Yerel kurulum

1. `pnpm install`
2. `.env.example` dosyasını `.env` olarak kopyalayın ve PostgreSQL, Better Auth ve Plunk değerlerini doldurun.
3. `pnpm db:deploy`
4. `pnpm dev`

Uygulama: `http://localhost:3000`; hesap: `/auth/register`; panel: `/panel`.

Plunk için `PLUNK_SECRET_KEY` gizli anahtar, `PLUNK_FROM_EMAIL` ise Plunk üzerinde doğrulanmış alan adına ait bir adres olmalıdır. İletişim formu bildirimlerinin alıcısı `PLUNK_CONTACT_TO_EMAIL` ile ayarlanır. `BETTER_AUTH_URL` uygulamanın dışarıdan erişilen kök URL'sidir. Üretimde `pnpm db:deploy` ile migration'ları uygulayın.

Şema değişikliklerinde `pnpm db:migrate --name <değişiklik-adı>` komutunu kullanın. `pnpm build` Prisma istemcisini yeniden üretir ve Next.js uygulamasını derler.

## Yönetim adresi ve güvenlik

**Settings → Security** bölümünde panelin adresini değiştirebilirsiniz. Tek bir yol seçin veya **Generate a private path** ile rastgele bir adres üretin. Yeni giriş bağlantısını kopyalayın, mevcut şifrenizi doğrulayın ve kaydedin. Tarayıcı yeni panel adresine geçer; standart `/panel` yolları artık 404 döner. `/panel` değerini kaydetmek standart adrese geri döndürür.

Özel adres etkin olduğunda yönetici şifre girişi, özel giriş sayfasının verdiği 20 dakikalık, HttpOnly ve imzalı giriş çerezini de gerektirir. Bu çerez adresi bildiğinizi gösterir; oturum veya yetki vermez. Better Auth şifreyi ve doğrulanmış e-postayı kontrol eder; panel sayfaları, API'ler ve sunucu işlemleri ayrıca veritabanındaki güncel yönetici rolünü kontrol eder. Normal üye girişi açık kalır ve özel panel adresini göstermez. Özel adres robots.txt'ye eklenmez; yönetici sayfaları önbelleğe alınmaz ve referrer göndermez.

İmza için en az 32 karakterlik, kalıcı `BETTER_AUTH_SECRET` gerekir. Giriş denemeleri mevcut Better Auth ayarıyla IP başına dakikada 5 denemeyle sınırlıdır; bellek deposu süreç başınadır. Birden fazla uygulama örneğine geçilirse ortak bir rate-limit deposu kullanılmalıdır. Özel adres kaybedilirse sunucu/veritabanı yöneticisi `Setting` tablosundaki `security.panelPath` değerini JSON metni `"/panel"` olarak değiştirebilir; oturum ve rol kontrolleri devam eder.

Yol doğrulama, bağlantı eşleme ve sahte/süresi dolmuş giriş çerezleri için testler: `pnpm test:admin-access`. Uygulama yaklaşımı [Next.js yetkilendirme rehberi](https://nextjs.org/docs/app/guides/authentication), [Better Auth hooks](https://www.better-auth.com/docs/concepts/hooks) ve [rate limit belgelerine](https://www.better-auth.com/docs/concepts/rate-limit) dayanır.

## MCP server

Panelin tüm işlevleri MCP üzerinden de kullanılabilir: blog yazıları, kategori ve etiketler, temalar, eklentiler, güncelleme geçmişi, medya, ürün yorumları, gelen kutusu, kullanıcılar, ayarlar ve istatistikler. Her iki taşıma da aynı araçları sunar (`mcp/create-server.ts`, `mcp/tools/`). Ayarlar panelde **Settings → MCP** sekmesinden yönetilir (`/panel/settings?tab=mcp`). Yazma işlemleri orada seçilen yönetici hesabına atfedilir; seçim yoksa en eski admin/superadmin hesabı kullanılır. Hesap admin değilse araçlar çalışmaz.

### stdio (yerel istemciler)

`pnpm mcp` sunucuyu standart giriş/çıkış üzerinden başlatır. Claude Desktop `claude_desktop_config.json` örneği (yolu kendi proje dizininizle değiştirin):

```json
{
  "mcpServers": {
    "cmsmotive": {
      "command": "pnpm",
      "args": ["--dir", "C:/Users/kullanici/Projects/cmsmotive", "mcp"]
    }
  }
}
```

Windows'ta `pnpm` bir `.cmd` dosyası olduğundan istemci doğrudan çalıştıramazsa `"command": "cmd", "args": ["/c", "pnpm", "--dir", "C:/...", "mcp"]` kullanın. Aynı yapı Cursor, opencode ve stdio destekleyen diğer istemcilerde de geçerlidir.

### HTTP

Settings → MCP sekmesinde HTTP uç noktasını açın ve bir erişim token'ı oluşturun. Token yalnızca oluşturulduğu anda bir kez gösterilir; veritabanında sadece SHA-256 özeti tutulur. Yeniden oluşturmak eski token'ı hemen geçersiz kılar. Uç nokta kapalıysa ya da token yoksa `/api/mcp` 503 döner. İstekler `Authorization: Bearer <token>` başlığı ister; hatalı token 401, admin olmayan MCP kullanıcısı 403 döner. Uç nokta durumsuzdur: her `POST` bağımsızdır, `GET`/`DELETE` 405 döner.

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $CMSMOTIVE_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"client","version":"1.0.0"}}}'
```

Üretimde uç noktayı yalnızca HTTPS üzerinden açın ve token'ı gizli tutun. Araç grupları: `blog_posts_*`, `blog_categories_*`, `blog_tags_*`, `themes_*`, `extensions_*`, `changelog_*`, `media_*`, `reviews_*`, `inbox_*`, `users_*`, `settings_*`, `stats_overview`, `stats_daily_reads`, `stats_system`, `stats_mail`, `notifications_list`, `account_info`, `ai_generate_image` (OpenRouter ile görsel üretir ya da mevcut bir görseli talimata göre düzenler, sonucu medya kütüphanesine kaydeder). Oturum sahibinin kendi parolasını değiştirmesi MCP araçlarına dahil edilmedi.

## Telegram botu

Panel, Telegram üzerinden doğal dille yönetilebilir: yazı taslağı oluşturma ve yayınlama, kapak görselini AI ile üretme/düzenleme, yorum moderasyonu vb. Bot, MCP sunucusunun tüm araçlarını süreç içinde kullanan bir OpenRouter ajanıdır (`telegram/agent.ts`); bu yüzden `OPENROUTER_API_KEY` gerekir ve ajan modeli araç çağırmayı (tool calling) desteklemelidir.

1. @BotFather ile bir bot oluşturun (`/newbot`) ve token'ı **Settings → Telegram** sekmesine yapıştırın. Token `getMe` ile doğrulanır ve veritabanında saklanır; panelde yalnızca son 4 karakteri görünür.
2. Site HTTPS üzerinden çalışıyorsa webhook (`/api/telegram/webhook`) gizli bir `secret_token` ile otomatik kaydedilir. Yerelde (`http://localhost`) Telegram webhook çağıramaz; bunun yerine `pnpm telegram:poll` çalıştırın (kayıtlı bir webhook varsa `--force` ile kaldırılır, üretime dönerken botu panelden yeniden bağlayın).
3. **Link my Telegram** ile tek kullanımlık, 15 dakika geçerli bir bağlantı oluşturun ve Telegram'da açın. Bot yalnızca bağlanmış hesaplara cevap verir ve her hesap için onu bağlayan panel admini adına çalışır.

İki model kullanılır: **sohbet modeli** (Settings → Telegram; isteği anlar ve araçları çağırır, tool calling desteklemeli) ve **içerik modeli** (Settings → AI'daki metin modeli; yazıyı `ai_write_post` / `ai_rewrite_post` araçlarıyla asıl yazan model — paneldeki AI asistanıyla aynı prompt'lar, `lib/ai-writer.ts`). Kapak görselleri Settings → AI'daki görsel modeliyle üretilir.

Araştırma (Settings → AI → Research): açıkken yazı iki adımda üretilir. Önce bir araştırma modeli web'de arar (varsayılan `perplexity/sonar-pro`; seçenekler: diğer Perplexity modelleri, örn. `sonar-deep-research`, ya da içerik modelinin kendi web araması — Gemini'de Google Search) ve her bilgiyi kaynak numarasıyla not eder. Sonra içerik modeli yalnızca bu notlardan yazar; metindeki `[n]` atıfları kaynağa link olur ve yazının sonuna yalnızca atıf yapılan kaynaklardan oluşan numaralı bir kaynakça (Kaynakça / Sources / Quellen) eklenir. Araştırma hiç kaynak bulamazsa yazı oluşturulmaz. Ayar açıkken MCP/Telegram araştırmayı kapatamaz; panelin AI asistanı da aynı akışı kullanır (`lib/ai-writer.ts`).

Onay akışı: okuma, AI ile taslak yazma, görsel üretme ve taslak olarak yazı oluşturma doğrudan çalışır. Diğer tüm değişiklikler (düzenleme, yayınlama, silme, kategori/etiket oluşturma, ayarlar) sohbette ✅/✖️ onayı bekler; aynı adımdaki değişiklikler tek seferde sorulur. Ajanın oluşturduğu veya değiştirdiği her yazı için bir kart gelir: 7 gün geçerli imzalı önizleme linki (`/blog/<slug>?preview=…`, giriş gerektirmez, `lib/post-preview.ts`), panel linki ve **🚀 Publish** / **🗑 Discard** butonları. Yayına alma yalnızca bu butonla ya da açık bir "yayına al" isteği + onayla olur. Sohbetin son 30 mesajı `Setting` tablosunda tutulur, böylece "bu kapağı biraz daha koyu yap" gibi devam istekleri çalışır; `/new` geçmişi siler. Fotoğraf gönderildiğinde medya kütüphanesine yüklenir ve ajan onu kapak olarak ya da düzenleme kaynağı olarak kullanabilir.

## Yapı

- `app/legacy/[locale]/[slug]/route.ts`: mevcut genel HTML sayfaları (`next.config.ts` içindeki rewrite'lar `static-site/*.html` dosyalarını her dil için uzantısız URL'lere bağlar; yeni sayfa ekledikten sonra `pnpm dev`'i yeniden başlatın)
- Çoklu dil (`lib/i18n/`, `i18n/`): genel site Almanca (varsayılan, öneksiz: `/themes`), İngilizce (`/en/themes`) ve Türkçe (`/tr/themes`) sunulur; `/de/...` adresleri öneksiz adrese yönlendirilir. Statik sayfaların kaynağı İngilizcedir; sunucu her isteği `i18n/legacy/<dil>/*.json` kataloğuyla çevirir, iç linklere dil önekini ekler ve `<html lang>`'i ayarlar. Anahtar, metnin İngilizcesidir; marka adları ve kod `i18n/legacy/untranslated.json` içindedir. React sayfaları (`app/[locale]/blog`) aynı kataloğu `getTranslator()` ile kullanır; yalnızca React'te geçen metinler `i18n/app/<dil>.json` içindedir. `proxy.ts` URL'deki dili kök layout'a iletir. `site.js` içindeki dinamik metinler (form durumları, yorumlar) `SITE_STRINGS` tablosundadır. Bir sayfanın metnini değiştirdikten sonra `pnpm i18n:check` eksik çevirileri listeler (`--write` ile `i18n/legacy/_missing/` altına yazar). Uzun Almanca bileşik kelimeler başlıklarda taşmasın diye çevirilerde `&shy;` kullanılabilir.
- Ana sayfa güven bölümleri: "Frühzugang / Early access" bölümü (`build.py` → `early_voices()`) uydurma alıntı göstermez. `<!-- voices:reviews limit=3 min=3 -->` bölgesini `lib/testimonials.ts` en yeni onaylı 4–5 yıldızlı ve en az 40 karakterlik ürün yorumlarıyla değiştirir (`/panel/reviews`). Kalan yerlerde ve hiç yorum yokken "Beta-Platz" (açık beta koltuğu) kartları durur. Lisans önizlemesi (`pricing_preview()`) fiyat sayfasıyla aynı üç kademeyi gösterir; fiyat değişirse ikisini birlikte güncelleyin.
- SEO (`lib/seo.ts`): mutlak URL'ler `NEXT_PUBLIC_SITE_URL`'den gelir (yoksa `BETTER_AUTH_URL`, o da yoksa isteğin host'u); üretimde mutlaka ayarlayın. Statik sayfalara legacy route çeviriden sonra `addLegacySeo()` ile canonical, hreflang, `og:url`, `og:locale` (+ alternatifler), mutlak `og:image` ve JSON-LD ekler. JSON-LD sayfanın çevrilmiş işaretlemesinden okunur, böylece her dilde görünen metinle aynıdır: ana sayfada Organization ve WebSite, `faq-item` SSS bloklarından FAQPage, `.crumbs`'tan BreadcrumbList (makalelerde son adım başlıktır), `/themes` ve `/extensions` kartlarından ItemList ("Yakında" kartları hariç). Dilden bağımsız etiketler (`og:type`, `og:site_name`, `og:image:width/height`, `twitter:card`, `twitter:site`) `build.py`'deki `page()` içindedir. Paylaşım görselleri `assets/images/og/` altındaki 1200×630 JPEG kopyalardır (WebP önizlemeyi her platform göstermez). React sayfaları (blog, tema/eklenti detayı) metadata'yı `pageMetadata()` ile üretir; kök layout `metadataBase`'i ayarlar ve hesap alanı için `noindex` varsayılanını taşır. Detay sayfalarında Product (yalnızca `published` ürünlerde fiyat teklifi, onaylı yorumlardan AggregateRating) ve BreadcrumbList, blog yazılarında BlogPosting ve BreadcrumbList vardır. `app/sitemap.ts` tüm statik sayfaları, blogu, yayınlanmış yazıları ve tema/eklenti detaylarını üç dilde hreflang alternatifleriyle listeler; `app/robots.ts` `/panel`, `/auth/`, `/api/` ve `/legacy/`'yi kapatır ve sitemap'i gösterir.
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`: 404 ve 500 ekranları; `app/[locale]/blog/(journal)/loading.tsx`: blog listesinin yükleniyor ekranı. İçerikleri `static-site/404.html`, `500.html` ve `loading.html` dosyalarından gelir. Bu dosyalar `build.py` içindeki `status_page` ile üretilir ve ham metin olarak import edilir (`next.config.ts` → `turbopack.rules`, `raw-loader`). Böylece topbar, header ve footer ana sayfayla aynı kalır. Bu sayfalarda değişiklik yapınca `build.py`'yi yeniden çalıştırın. Kök dizine `loading.tsx` koymayın: streaming status kodunu erken gönderir, `notFound()` 200'e döner ve `redirect()` gerçek bir yönlendirme olmaktan çıkar.
- `app/auth/`: gerçek kayıt, giriş, doğrulama ve parola sıfırlama sayfaları — her biri kendi klasöründe bir React sayfası (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`); paylaşılan kabuk ve form bileşenleri `app/auth/_components/` altında, tasarım katmanı `app/auth/auth-refined.css`'te
- `app/api/auth/[...all]/route.ts`: Better Auth API
- `app/panel/`: korumalı hesap paneli
- `prisma/schema.prisma`: PostgreSQL üzerindeki Better Auth tabloları
- `lib/plunk.ts`: doğrulama ve parola sıfırlama e-postaları
- `app/api/contact/route.ts`: iletişim formunu kaydeder ve Plunk ile bildirir
- Ürün kataloğu (`lib/catalog.ts`): temalar ve eklentiler `/panel/themes` ve `/panel/extensions` üzerinden düzenlenir; sitede panel sıralamasıyla (`Sort order`) görünür. Ana sayfanın ürün bölümü ilk 3 temayı ve ilk 3 eklentiyi, `/themes` ve `/extensions` sayfaları tamamını gösterir. Sayfalar `<!-- catalog:themes -->` ve `<!-- catalog:extensions -->` işaretli bölgeleri sunucuda veritabanındaki kartlarla değiştirir (seçenekler: `ids`, `limit=N`, `min=N`); veritabanına ulaşılamazsa `build.py`'deki statik kartlar kalır. `min=N` ızgarayı N karta tamamlamak için "Yakında" (Coming soon) yer tutucu kartları ekler: ana sayfada 3 tema ve 3 eklenti, `/themes` ve `/extensions` sayfalarında en az 6 kart görünür, liste boş olsa bile bölümler gizlenmez. Yer tutucular tel kafes bir sayfa çizimi ve ışıltılı iskelet satırlarından oluşur (`build.py` → `theme_placeholder()`, `extension_placeholder()`; `lib/catalog.ts`; stiller `site.css` sonunda); `/themes` filtresi etkinken gizlenir. Aynı listeler `GET /api/themes` ve `GET /api/extensions` ile JSON olarak sunulur. Kayıtlar panelde ayrı sayfalarda oluşturulur (`/panel/themes/new`) ve düzenlenir (`/panel/themes/<id>`); eklentiler için aynısı `/panel/extensions` altındadır. Açıklama alanı Tiptap 3 tabanlı zengin editördür (`app/panel/_components/editor/`): başlıklar, renk ve vurgu, hizalama, görev listesi, tablo, link, boyutlandırılabilir görsel, video ve YouTube. Editördeki görsel/video düğmeleri ile kapak ve galeri alanları medya kütüphanesi seçicisini açar (`media-picker.tsx`, `GET /api/admin/media`): yüklü dosyalardan seçilir ya da yeni dosya yüklenir. Görseller her yüklemede tarayıcıda WebP'ye optimize edilir (`lib/webp.ts`, panel ayarları). Açılış kataloğunu (kapak ve galerileriyle) eklemek için `pnpm db:seed:catalog`: eksik kayıtları ekler, galerisi boş açılış kayıtlarının galerisini doldurur, panelde düzenlenmiş diğer alanlara dokunmaz.
- Ürün yorumları: tema detay sayfalarında (`theme-nordform`, `theme-foundation`, `theme-campus`) Açıklama, Yorumlar ve Güncelleme geçmişi sekmeleri var; Nordform'da ayrıca Uyumluluk sekmesi bulunur. Sekmeler `build.py` içinde üretilir, davranış `assets/js/product.js` ve stiller `assets/css/product.css` dosyalarındadır. Yorumlar üyelik gerektirmez: ad soyad, e-posta, 1–5 yıldız ve yorum metni istenir. Gönderimler Google reCAPTCHA v3 ile doğrulanır; `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` ve `RECAPTCHA_SECRET_KEY` olmadan yorum gönderilemez. Bir e-posta adresi saatte en fazla 3 yorum gönderebilir. `app/api/reviews/route.ts` yalnızca onaylanmış yorumları ve puan özetini döndürür, yeni yorumları `pending` olarak kaydeder. `/panel/reviews` sayfasında yorumlar onaylanır, reddedilir ya da silinir; menüdeki sayaç bekleyen yorumları gösterir. Yorum yapılabilecek ürünler `lib/reviews.ts` içinde tanımlıdır. Sayfadaki metinlerin çevirileri `i18n/legacy/<dil>/product.json` dosyasında, JavaScript metinlerinin çevirileri ise `product.js` içindedir.

Statik sayfada değişiklik yapınca `static-site/build.py` ile HTML'leri yeniden üretin. `static-site/assets/` altında değiştirdiğiniz dosyaları `public/assets/` dizinine de kopyalayın. Statik blog önizlemelerindeki eski yorumlar tarayıcıda kalır; gerçek React blog sayfaları aşağıdaki moderasyon akışını kullanır.

## Blog yorumları

Blog alt menüsü açılıp kapanır; Posts, Categories, Tags ve Comments bölümlerini içerir. Blog sayfalarında menü açık gelir ve aktif alt sayfa işaretlenir. **Blog → Comments** (`/panel/blog/comments`) yorumları yazıya ve metne göre filtreler, sayfalar; yöneticiler yorumları onaylayabilir, reddedebilir, yeniden beklemeye alabilir veya onay penceresinden silebilir. Bekleyen yorum sayısı menüde ve bildirimlerde görünür.

Gerçek blog yazılarında yorumlar ve tek seviyeli yanıtlar `PostComment` tablosuna kaydedilir. Yeni kayıtlar onay bekler; yalnızca onaylı ana yorumlar ve onaylı yanıtları yayınlanır. E-posta adresleri ziyaretçilere gönderilmez. `/api/blog-comments` girişleri sunucuda doğrular, yinelenen gönderimleri tekilleştirir ve e-posta başına saatte üç yeni kayıtla sınırlar. Taslaklara yorum gönderilemez. Yazı silinince yorumları, ana yorum silinince yanıtları da silinir.

Yeni yorumlar yanıt gönderildikten sonra OpenRouter üzerinden AI kontrolüne alınır. Settings → AI metin modeli kullanılır; model seçilmemişse uygulamanın varsayılan metin modeli kullanılır. Yalnızca yorum metni modele iletilir; isim ve e-posta alanları gönderilmez. Kontrol sonucu, gerekçesi ve modeli Comments tablosunda görünür. AI hiçbir yorumu kendiliğinden yayınlamaz veya reddetmez. Anahtar eksikse `Unavailable`, sağlayıcı/yanıt hatasında `Check failed` gösterilir; üç nokta menüsündeki `Run AI review` ile yeniden denenebilir. Eski yorumlar `Not checked` olarak işaretlenir. AI doğrulama testleri: `pnpm test:comment-ai` ve `pnpm test:comment-ai:db` (kendisine ait geçici kayıtlar temizlenir; gerçek AI çağrısı yapmaz).

Şema geçişi: `pnpm db:deploy`, ardından `pnpm db:generate`; model değişikliğinden sonra açık geliştirme sunucusunu yeniden başlatın. Doğrulama testleri: `pnpm test:blog-comments`. Veritabanı testleri: `pnpm test:blog-comments:db` (geçici kayıtlar işlem sonunda geri alınır).
