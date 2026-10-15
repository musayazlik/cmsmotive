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

## Yapı

- `app/legacy/[locale]/[slug]/route.ts`: mevcut genel HTML sayfaları (`next.config.ts` içindeki rewrite'lar `static-site/*.html` dosyalarını her dil için uzantısız URL'lere bağlar; yeni sayfa ekledikten sonra `pnpm dev`'i yeniden başlatın)
- Çoklu dil (`lib/i18n/`, `i18n/`): genel site Almanca (varsayılan, öneksiz: `/themes`), İngilizce (`/en/themes`) ve Türkçe (`/tr/themes`) sunulur; `/de/...` adresleri öneksiz adrese yönlendirilir. Statik sayfaların kaynağı İngilizcedir; sunucu her isteği `i18n/legacy/<dil>/*.json` kataloğuyla çevirir, iç linklere dil önekini ekler, `<html lang>` ve hreflang etiketlerini ayarlar. Anahtar, metnin İngilizcesidir; marka adları ve kod `i18n/legacy/untranslated.json` içindedir. React sayfaları (`app/[locale]/blog`) aynı kataloğu `getTranslator()` ile kullanır; yalnızca React'te geçen metinler `i18n/app/<dil>.json` içindedir. `proxy.ts` URL'deki dili kök layout'a iletir. `site.js` içindeki dinamik metinler (form durumları, yorumlar) `SITE_STRINGS` tablosundadır. Bir sayfanın metnini değiştirdikten sonra `pnpm i18n:check` eksik çevirileri listeler (`--write` ile `i18n/legacy/_missing/` altına yazar). Uzun Almanca bileşik kelimeler başlıklarda taşmasın diye çevirilerde `&shy;` kullanılabilir.
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`: 404 ve 500 ekranları; `app/[locale]/blog/(journal)/loading.tsx`: blog listesinin yükleniyor ekranı. İçerikleri `static-site/404.html`, `500.html` ve `loading.html` dosyalarından gelir. Bu dosyalar `build.py` içindeki `status_page` ile üretilir ve ham metin olarak import edilir (`next.config.ts` → `turbopack.rules`, `raw-loader`). Böylece topbar, header ve footer ana sayfayla aynı kalır. Bu sayfalarda değişiklik yapınca `build.py`'yi yeniden çalıştırın. Kök dizine `loading.tsx` koymayın: streaming status kodunu erken gönderir, `notFound()` 200'e döner ve `redirect()` gerçek bir yönlendirme olmaktan çıkar.
- `app/auth/[mode]/route.ts` ve `public/auth-live.js`: mevcut hesap tasarımları üzerinden gerçek kayıt, giriş, doğrulama ve parola sıfırlama akışları
- `app/api/auth/[...all]/route.ts`: Better Auth API
- `app/panel/`: korumalı hesap paneli
- `prisma/schema.prisma`: PostgreSQL üzerindeki Better Auth tabloları
- `lib/plunk.ts`: doğrulama ve parola sıfırlama e-postaları
- `app/api/contact/route.ts`: iletişim formunu kaydeder ve Plunk ile bildirir
- Ürün kataloğu (`lib/catalog.ts`): temalar ve eklentiler `/panel/themes` ve `/panel/extensions` üzerinden düzenlenir; sitede panel sıralamasıyla (`Sort order`) görünür. Ana sayfanın ürün bölümü ilk 3 temayı ve ilk 3 eklentiyi, `/themes` ve `/extensions` sayfaları tamamını gösterir. Sayfalar `<!-- catalog:themes -->` ve `<!-- catalog:extensions -->` işaretli bölgeleri sunucuda veritabanındaki kartlarla değiştirir (seçenekler: `ids`, `limit=N`); veritabanına ulaşılamazsa `build.py`'deki statik kartlar kalır. `data-catalog-section` taşıyan bloklar liste boşken gizlenir. Aynı listeler `GET /api/themes` ve `GET /api/extensions` ile JSON olarak sunulur. Kayıtlar panelde ayrı sayfalarda oluşturulur (`/panel/themes/new`) ve düzenlenir (`/panel/themes/<id>`); eklentiler için aynısı `/panel/extensions` altındadır. Açıklama alanı Tiptap 3 tabanlı zengin editördür (`app/panel/_components/editor/`): başlıklar, renk ve vurgu, hizalama, görev listesi, tablo, link, boyutlandırılabilir görsel, video ve YouTube. Editördeki görsel/video düğmeleri ile kapak ve galeri alanları medya kütüphanesi seçicisini açar (`media-picker.tsx`, `GET /api/admin/media`): yüklü dosyalardan seçilir ya da yeni dosya yüklenir. Görseller her yüklemede tarayıcıda WebP'ye optimize edilir (`lib/webp.ts`, panel ayarları). Açılış kataloğunu (kapak ve galerileriyle) eklemek için `pnpm db:seed:catalog`: eksik kayıtları ekler, galerisi boş açılış kayıtlarının galerisini doldurur, panelde düzenlenmiş diğer alanlara dokunmaz.
- Ürün yorumları: tema detay sayfalarında (`theme-nordform`, `theme-foundation`, `theme-campus`) Açıklama, Yorumlar ve Güncelleme geçmişi sekmeleri var; Nordform'da ayrıca Uyumluluk sekmesi bulunur. Sekmeler `build.py` içinde üretilir, davranış `assets/js/product.js` ve stiller `assets/css/product.css` dosyalarındadır. Yorumlar üyelik gerektirmez: ad soyad, e-posta, 1–5 yıldız ve yorum metni istenir. Gönderimler Google reCAPTCHA v3 ile doğrulanır; `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` ve `RECAPTCHA_SECRET_KEY` olmadan yorum gönderilemez. Bir e-posta adresi saatte en fazla 3 yorum gönderebilir. `app/api/reviews/route.ts` yalnızca onaylanmış yorumları ve puan özetini döndürür, yeni yorumları `pending` olarak kaydeder. `/panel/reviews` sayfasında yorumlar onaylanır, reddedilir ya da silinir; menüdeki sayaç bekleyen yorumları gösterir. Yorum yapılabilecek ürünler `lib/reviews.ts` içinde tanımlıdır. Sayfadaki metinlerin çevirileri `i18n/legacy/<dil>/product.json` dosyasında, JavaScript metinlerinin çevirileri ise `product.js` içindedir.

Statik sayfada değişiklik yapınca `static-site/build.py` ile HTML'leri yeniden üretin. `static-site/assets/` altında değiştirdiğiniz dosyaları `public/assets/` dizinine de kopyalayın. Eski blog yorumları yalnızca tarayıcıda tutulur; bunlar için henüz veritabanı işlemi tanımlanmadı.
