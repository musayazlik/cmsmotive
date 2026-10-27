# Sürükle-bırak sayfa oluşturucu: plan

- **Durum:** plan, 3. sürüm (26 Ekim 2026). Faz 0 prototipi yapıldı (`/pb`, `/pb-edit`), incelendi ve inceleme bulguları prototipte tamamlandı (bölüm 7, "Faz 0 incelemesi"). Faz 1 başlamadı.
- **Kimin için:** Bu planı uygulayacak geliştirici. Ürün kararları alındı (bölüm 2). Teknik kararların gerekçeleri ve doğrulanması gerekenler belirtildi.
- **Amaç:** Her mağazanın kendi landing page'ini ve sayfalarını panelden, sitenin kendi bileşenleriyle sürükle-bırak tasarlamak. İlk taşınacak statik sayfa ana sayfa.

---

## 0. Bu sürümde düzeltilenler ve eklenenler

| # | Konu | Önceki plan | Düzeltme | Bölüm |
|---|---|---|---|---|
| 1 | Yönlendirme | `app/[locale]/(pages)/[[...slug]]` + `rewrites().fallback` ile öneksiz URL'ler | **Hatalı.** Next 16'da dinamik route'lar (7. adım) fallback rewrite'tan (8. adım) önce eşleşir. `/black-friday` isteği `locale="black-friday"` olarak yakalanır, fallback hiç çalışmaz. Öneksiz URL'ler `proxy.ts` içinde, yayındaki sayfa listesine bakılarak rewrite edilecek | 5.8 |
| 2 | Önbellek | `unstable_cache` + `updateTag` | Next 16 belgesi: `unstable_cache` yerini `use cache` + Cache Components'a bıraktı. Projede `cacheComponents` kapalı ve kök layout `headers()` okuduğu için tüm sayfalar zaten dinamik. v1'de sayfa önbelleği yok; ölç, gerekirse proje genelinde Cache Components'a geç | 5.7 |
| 3 | Varsayılan dil | "de öneksiz" varsayımı | `Store.defaultLocale` var ama `lib/i18n/config.ts` (`splitLocale`, `localizePath`) ve `next.config.ts` rewrite'ları `de`'yi sabit kodlamış. Global mağaza (yalnızca EN, öneksiz) için bu bir **önkoşul** | 4 |
| 4 | Etkileşim ve animasyon | — | Bloklar `site.js` davranışlarına (`data-reveal`, SSS, bülten formu) dayanırsa istemci tarafı gezinmede içerik gizli kalabilir. Kök layout `<html class="js">` ile başlıyor; `site.js`'teki gözlemci yalnızca ilk yüklemede bir kez bağlanıyor. Etkileşimli bloklar React istemci bileşeni olacak | 5.10 |
| 5 | Grid düzeni | — | Puck her bileşeni bir `div`'e sarar. Bu, grid ve flex alt öğesi kurallarını bozar. Grid çocukları `inline: true` + `puck.dragRef` kullanmalı | 5.2 |
| 6 | Zengin metin | "Tiptap tabanlı `richtext`" | Faz 0: değer HTML dizesi olarak saklanıyor ve `<Render>` onu **hiç temizlemeden** basıyor (`onerror`, `<script>`, `javascript:` aynen çıktı). Render öncesi temizleme zorunlu | 5.13, 7 |
| 7 | Kaydetme boyutu | "1 MB belge sınırı" | Server Action gövde sınırı varsayılan **1 MB**. Faz 0 ölçümü: tipik belge ~55 KiB, stres belgesi ~165 KiB. Server Action yeterli; sınıra yaklaşılırsa Route Handler | 5.6 |
| 8 | Fontlar | Serbest font seçimi | Fontlar `font-display: optional` ile geliyor. Önceden yüklenmeyen bir font ilk ziyarette hiç görünmeyebilir. Sayfada kullanılan fontlar hesaplanıp preload edilmeli | 5.5 |
| 9 | Gömülü içerik | "YouTube nocookie, Maps" | Projede çerez onayı altyapısı yok. Mevcut çerez metni "üçüncü taraf araç eklemeden önce onay yeniden değerlendirilmeli" diyor. İki tıklamalı gömme + metin güncellemesi gerekli | 5.12 |
| 10 | Editör yerleşimi | — | Tüm `/panel/*` sayfaları `PanelShell` içinde ve özel panel adresi (`panelPath`) korumasına bağlı. Tam ekran editör kabuğu atlamalı ama `/panel` altında kalmalı | 5.6 |
| 11 | Eski ana sayfa eşdeğerliği | — | Legacy route şunları yapıyor: katalog ve yorum enjeksiyonu, `trackPageView("index")`, bülten onay sürümü, SEO ve JSON-LD, `Content-Language`, oturumlu ziyaretçide `private` önbellek. Hepsi karşılanmalı | 5.9 |
| 12 | Diğerleri | — | Slug kuralları ve 301 yönlendirmeleri, medya kullanım sayımı, yedekleme, erişilebilirlik yasası (BFSG), görseller ve CLS, tarih ve sürüm sabitleme | 5.x |
| 13 | Kırılım noktaları (3. sürüm) | Plan 900/620; prototip 1023.98/767.98 | Prototip `site.css`'ten farklı kırılımlar kullanıyor; Faz 1'de 900/620'ye hizalanacak | 5.3, 7 |
| 14 | XSS sınırı (3. sürüm) | "Kayıtta ve render'da temizlenir" | Prototipte yalnızca kaydetme eylemi temizliyordu. Artık `lib/page-builder/document.ts` tek kapı: her yazma `prepareDocument`, her render `renderableDocument`'tan geçiyor (tamamlandı) | 5.13 |
| 15 | Eleman dili (3. sürüm) | — | Temizleyici tüm öznitelikleri siliyor (`"*": []`). Metin içi `<span lang="en">` kaybolur; `lang` izinli olmalı | 5.13 |
| 16 | Doğrulama (3. sürüm) | — | Prototipte `root` doğrulanmıyor ve dizi olan her alan "slot" sayılıyor; dizi alanlı bloklar (SSS maddeleri vb.) gelince bozulur. Slot alanları blok başına açıkça listelenmeli | 5.13 |

---

## 1. Mevcut durum

| Konu | Durum (kod referansı) |
|---|---|
| Çatı | Next.js 16 App Router, React 19, TypeScript, Prisma 7 + PostgreSQL, Node 26 |
| Stil | Tailwind yok. `public/assets/css/site.css` (≈127 KB) |
| Kırılım noktaları | `site.css` ağırlıkla `max-width: 1100px`, `900px`, `620px` kullanıyor |
| CSS değişkenleri | `--indigo`, `--ink`, `--surface`, `--line` vb. (`:root`) |
| Fontlar | Kendi sunucumuzda, Latin alt kümeleri önceden yükleniyor, `font-display: optional` (`lib/fonts.ts`, `scripts/fonts/build-fonts.py`) |
| Ana sayfa | `static-site/index.html` → `app/legacy/[locale]/[slug]/route.ts` (ham HTML). 11 bölüm; `site.js` ile animasyon, ürün filtresi, SSS, bülten formu, kopyala butonları |
| React sayfalar | Ürünler, blog, yasal. `SiteFrame` (`app/[locale]/_components/site-chrome.tsx`) üst çubuk, header, footer, hesap menüsü, bakım uyarısı ve `site.js` yüklüyor. Sayfalar `trackPageView` çağırıyor |
| Diller | `de` (öneksiz), `en`, `tr`. `proxy.ts` dili belirliyor. `lib/i18n/config.ts` ve `next.config.ts` de-merkezli |
| Çok mağaza | `Store` (`defaultLocale`, `locales`), `StoreDomain`, `resolveRequestStore`. Mağaza anahtarları koda yazılmıyor |
| Yetki | `requirePanelUser()` / `requireAdmin()` → mağaza rolü `admin` veya `superadmin` (`isAdminRole`) |
| Panel | `app/panel/layout.tsx` → `PanelShell`, `PanelNavigationProvider` (özel `panelPath`), `UploadSettingsProvider` |
| Medya | `MediaAsset` (`width`, `height`, `alt` tek dil), UploadThing veya R2 (`/api/media/r2/...`). Kullanım sayımı HTML içinde dosya anahtarı arıyor (`lib/media-usage.ts`) |
| Önbellek | Veri önbelleği yok. Kök layout `headers()` okuyor, sayfalar dinamik. `cacheComponents` kapalı |
| Güvenlik başlıkları | Site genelinde CSP yok |
| Çerez onayı | Yok. Yalnızca zorunlu çerezler; çerez metni yeni üçüncü taraf için yeniden değerlendirme şart koşuyor |

---

## 2. Ürün kararları

| # | Konu | Karar |
|---|---|---|
| 1 | Kim düzenler | Mağaza **admin**'i ve **superadmin**. Ayrı "editor" rolü yok |
| 2 | Diller | Her dil **bağımsız belge**. Her elemanın **dili** (`lang`) ve içeriği ayrı ayrı düzenlenebilir |
| 3 | Tasarım | Container ve grid gibi **düzen yapıları hazır varyantlı**. Her elemanın **font, font boyutu, renk, margin, padding, arka plan rengi ve görseli** serbestçe ayarlanır |
| 4 | Taşıma | Şimdilik yalnızca **ana sayfa** |
| 5 | Mağazalar | **Mağaza bazlı.** Her mağazanın kendi ana sayfası, landing page'leri ve teması |

---

## 3. Kütüphane seçimi

Sürüm ve lisanslar `npm view` ile 26.10.2026'da doğrulandı.

| Seçenek | Sürüm / lisans | Değerlendirme |
|---|---|---|
| **Puck** `@puckeditor/core` | **0.23.0**, MIT, React 18/19, Node ≥20, 2,6 MB | **Seçildi.** Kendi React bileşenlerimiz blok olur. JSON veri. Sunucuda `<Render>` / `resolveAllData`. Ayrıca: `slot`, `inline` + `dragRef`, `object`/`array`/`custom`/`external` alanlar, `richtext` (Tiptap), `contentEditable`, `resolveData`/`resolveFields`/`resolvePermissions`, `viewports`, `overrides`, `walkTree`, `transformProps`, `migrate()` |
| Craft.js | 0.2.12, MIT | Editör arayüzü bize kalır. Son güncelleme Şubat 2025 |
| GrapesJS (+ React) | 0.23.8 BSD-3 / 2.0.0 MIT | HTML/CSS üretir, bileşenlerimizi kullanmaz |
| dnd-kit ile kendi editörümüz | `@dnd-kit/react` 0.5.1 | En uzun yol |
| Builder.io / Plasmic | Ticari SaaS | Veri dışarıda |

Puck'ın getirdiği bağımlılıklar ve dikkat edilecekler:
- **Tiptap:** `@tiptap/*` `^3.11.1`. Projede 3.31 var, aralık uyumlu. Kurulumdan sonra `pnpm why @tiptap/pm` ile **tek kopya** olduğu doğrulanmalı. İki ProseMirror kopyası editör hatalarına yol açar.
- **dnd-kit:** `@dnd-kit/react` / `@dnd-kit/dom` **0.4.0'a sabit**. Projeye ayrıca dnd-kit eklenmemeli; eklenirse aynı sürüm seçilmeli.
- **happy-dom ve `@tiptap/html`:** sunucuda zengin metin işleme için olduğu anlaşılıyor. Next sunucu paketine dahil oluyor mu, `serverExternalPackages` gerekiyor mu, Faz 0'da kontrol edilmeli.
- **Sürüm:** 0.x olduğu için **tam sürüm sabitlenir** (`"@puckeditor/core": "0.23.0"`, caret yok). Yükseltme `migrate()` + testlerle yapılır. 0.21'den beri paket adı `@puckeditor/core`; eski `@measured/puck` kullanılmaz.
- **Editör CSS'i:** `@puckeditor/core/no-external.css` (CDN'den Inter fontu çekmez).
- **Editör dili:** Puck arayüzü İngilizce. Blok ve alan etiketleri panel dili (`systemLanguage`) ile çevrilebilir.

---

## 4. Önkoşullar (oluşturucudan önce veya Faz 1 içinde)

**P1. Mağazaya duyarlı varsayılan dil**
`splitLocale`, `localizePath`, `DEFAULT_LOCALE` ve `next.config.ts` içindeki `/de/...` rewrite ve redirect'leri `Store.defaultLocale`'e duyarlı hale getirilmeli. En azından oluşturucu sayfaları için:
- Global mağazada `/` İngilizce ana sayfayı açmalı.
- Global mağazada `/en/...` → öneksize 301 olmalı.

Bu yapılmadan Faz 3'teki "global mağazanın kendi ana sayfası" İngilizce öneksiz çalışmaz.

**P2. Panelde tam ekran sayfa**
`PanelShell` için "çıplak" mod: belirli bir yol desenine göre (ör. `.../pages/[id]/edit`) kabuk çizilmez. Sağlayıcılar kalır: `PanelNavigationProvider`, `UploadSettingsProvider`. Alternatif olarak tüm panel route'larını bir `(shell)` route grubuna taşımak mümkün, ama daha büyük bir değişiklik.

**P3. HTML temizleyici**
Faz 0'da seçildi: `sanitize-html` 2.18.1 (tam sürüm), `lib/page-builder/sanitize.ts`. Kalan iş: aynı temizleyici blog içeriğine de uygulanmalı; blog şu an temizlenmeden basılıyor.

---

## 5. Mimari

### 5.1 Veri modeli

```prisma
/// A page built with the visual editor, owned by one store. Each store has at most one home page (kind "home", slug "").
model Page {
  id        String       @id @default(cuid())
  storeId   String
  store     Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  slug      String       // "" for home; lowercase a-z0-9, "-" and "/" segments
  kind      String       @default("landing") // home | landing | page
  locales   PageLocale[]
  redirects PageRedirect[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  @@unique([storeId, slug])
}

/// One language version: own Puck document, SEO and publication state.
model PageLocale {
  id             String         @id @default(cuid())
  pageId         String
  page           Page           @relation(fields: [pageId], references: [id], onDelete: Cascade)
  locale         String         // one of the store's locales
  title          String
  seoTitle       String?
  seoDescription String?
  ogImageId      String?        // MediaAsset id
  noindex        Boolean        @default(false)
  status         String         @default("draft") // draft | published | scheduled | unpublished
  draft          Json
  published      Json?
  publishedCss   String?        // scoped CSS generated at publish time (5.4)
  usedFonts      String[]       @default([]) // font files to preload (5.5)
  schemaVersion  Int            @default(1)
  version        Int            @default(0)   // optimistic locking
  publishedAt    DateTime?
  publishAt      DateTime?
  updatedById    String?
  revisions      PageRevision[]
  @@unique([pageId, locale])
}

/// Copy of every publish for history and rollback (keep the last 50 per language).
model PageRevision {
  id           String     @id @default(cuid())
  pageLocaleId String
  pageLocale   PageLocale @relation(fields: [pageLocaleId], references: [id], onDelete: Cascade)
  data         Json
  authorId     String?
  note         String?
  createdAt    DateTime   @default(now())
  @@index([pageLocaleId, createdAt])
}

/// Old slugs keep working after a page is renamed (301 to the current slug).
model PageRedirect {
  id        String   @id @default(cuid())
  storeId   String
  fromSlug  String
  pageId    String
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([storeId, fromSlug])
}

/// Saved sections and page templates, per store.
model PageSnippet {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name      String
  kind      String   // section | template
  category  String?
  data      Json
  createdAt DateTime @default(now())
}
```

- **Yayın durumu dil başına:** DE yayında iken EN taslak olabilir.
- **Kayıtlı bölüm eklerken:** blok kimlikleri `walkTree` ile yenilenir. Aynı kimlik iki kez kullanılırsa kapsamlı CSS (5.4) çakışır.

### 5.2 Bloklar

**Düzen yapıları** (hazır varyantlı; serbest stil de uygulanabilir):

| Blok | Varyantlar | Not |
|---|---|---|
| Container | `narrow` 720, `default` 1200, `wide` 1440, `full` | 1 slot |
| Section | `plain`, `muted`, `dark`, `brand`, `image` (görsel + karartma) | 1 slot; `site.css` bölüm sınıflarıyla eşleşir |
| Grid | `2`, `3`, `4`, `1/3+2/3`, `2/3+1/3`, `1/4+3/4`; ≤900 px ve ≤620 px için ayrı sütun sayısı | Çocuklar **`inline: true` + `puck.dragRef`** (Puck sarmalayıcı `div`'i grid'i bozar) |
| Stack | yön, aralık `xs…xl`, hizalama | Flex çocukları da `inline` |
| Spacer, Divider | ölçek | — |

**İçerik:** Heading (H1–H4), Text (`richtext`), Button / ButtonGroup, Image, Gallery, Video, Icon, Badge, Quote, List, Code.

**Hazır bölümler:** Hero, FeatureGrid, Stats, LogoCloud, Testimonials, FAQ, CTA, ComparisonTable, Steps, Newsletter, Contact. İçerik elemanlarından kurulur, eklendikten sonra her parça ayrı düzenlenir.

**Veri bağlı:** ProductGrid (ana sayfadaki sektör filtresi dahil), ProductSpotlight, PricingTable, ReviewList / Testimonials (`ProductReview`), LatestPosts, Changelog.
- `external` alan + `resolveData`, sunucuda `resolveAllData`.
- Silinmiş veya yayından kalkmış ürün sessizce atlanır, sayfa hata vermez.

Her blok şunlara sahip:
- **`schema.ts`:** Zod şeması + varsayılanlar
- **`render.tsx`:** sunucu bileşeni. Kök öğede `data-pb={id}` ve gerekiyorsa `lang`. Etkileşim gerekiyorsa küçük bir istemci bileşeni çağırır (5.10).
- **Editör alanları:** istemci tarafında (`block-fields.tsx`); sunucu config'i yalnızca istemcisiz tanımları görür (5.16 kuralı)
- **Slot alan adları:** şemada açıkça listelenir (5.13)
- **Etiketler:** panel dilinde (`systemLanguage`)

Mağazaya özel bloklar mağaza ayarıyla açılır (`metadata.store`), mağaza anahtarıyla değil.

### 5.3 Stil paneli

Her bloğa ortak **Stil** sekmesi eklenir. Değerler yapılandırılmış veri olarak saklanır:

| Grup | Ayarlar |
|---|---|
| Tipografi | font ailesi (yalnızca kendi fontlarımız), boyut, kalınlık, satır yüksekliği, harf aralığı, hizalama, renk |
| Boşluk | margin / padding (kenar başına veya bağlı), `px`/`rem`/`%` |
| Arka plan | renk, 2 duraklı gradyan, görsel (medya kütüphanesi), konum, `cover`/`contain`, tekrar, karartma rengi ve opaklık |
| Kenar | kenarlık, köşe yuvarlaklığı, gölge ön ayarı |
| Boyut | genişlik, maks. genişlik, min. yükseklik |
| Görünürlük | masaüstü / tablet / mobilde gizle |
| Gelişmiş | `lang`, çapa `id`, ARIA etiketi |

- **Kırılım noktaları `site.css` ile aynı:** masaüstü (taban), tablet `max-width: 900px`, mobil `max-width: 620px`. Editör viewport'ları: 1440, 768, 390 (768 tablet aralığında, 390 mobil aralığında kalır).
  - Neden `site.css` ile aynı olmalı: bloklar ve `SiteFrame` (header, footer, bölüm sınıfları) `site.css`'in 900/620 kurallarıyla değişiyor. Oluşturucu farklı kırılım kullanırsa ara genişliklerde iki düzen karışır. Ör. 950 px'te site masaüstü, oluşturucu tablet stiliyle çizilir; 700 px'te site tablet, oluşturucu mobil stiliyle çizilir. Editörde bu aralıklar hiç görülmez.
  - Faz 0 prototipi `1023.98px`/`767.98px` kullanıyor (`lib/page-builder/style/css.ts` → `BREAKPOINTS`, `public/assets/css/pb-blocks.css`). Faz 1'de hizalanacak.
- **Duyarlı düzenleme:** Stil alanı aktif viewport'u `appState.ui.viewports.current.width` ile okur ve o kırılıma yazar. Taban değer masaüstü; tablet ve mobil isteğe bağlı üzerine yazmadır.
- **Renk:** serbest HEX + mağaza teması hızlı seçimi. Tema rengi seçilirse değişkene bağlanır (`var(--indigo)` gibi).
- **Doğrulama:** her değer tipine göre (renk regex, sayı + izinli birim, görsel yalnızca `MediaAsset` kimliği). Ham CSS veya `url()` girişi yok.

### 5.4 Stil çıktısı

- **Katman sırası:** blok temel sınıfları → varyant → mağaza teması (CSS değişkenleri) → eleman stili (masaüstü → tablet → mobil).
- **Çıktı:** Yayında stil verisi **kapsamlı CSS**'e çevrilir (`[data-pb="<id>"]{…}` + medya sorguları) ve `PageLocale.publishedCss` olarak saklanır. Sayfada tek `<style>` olarak basılır; her istekte yeniden hesaplanmaz. Editör önizlemesi aynı fonksiyonu canlı kullanır.
- **CSP:** Site genelinde CSP yok. İleride eklenirse bu `<style>` için nonce gerekir.
- **Editör araçları:** Panelde "Stili sıfırla" ve "Stili kopyala / yapıştır".

### 5.5 Tema ve fontlar

- **Tema:** Mağaza başına `StoreSetting` grubu `theme`. Mevcut `site.css` değişkenlerine eşlenir (`--indigo`, `--ink`, `--surface`, `--canvas`…); yeni bir değişken sistemi kurulmaz. Varsayılan font aileleri, temel boyut, köşe ve buton stili de burada.
- **Fontlar:**
  - Yalnızca kendi sunucumuzdaki fontlar seçilebilir.
  - Yayında sayfada kullanılan font dosyaları hesaplanır (`PageLocale.usedFonts`) ve bunlar preload edilir. Sebep: `font-display: optional` ile preload edilmeyen bir font ilk ziyarette hiç görünmeyebilir.
  - Bugün 7 Latin dosyasının hepsi preload ediliyor; Faz 4'te font yöneticisi gelince bu sayfa bazına geçmeli.
- **Font yöneticisi (Faz 4):** OFL fontu yükleme → `build-fonts.py` mantığıyla sunucuda Latin/ext bölme, hash'li dosya adı, `@font-face` üretimi.

### 5.6 Editör (panel)

- **Yetki:** `requirePanelUser()` / `requireAdmin()` + `panelStore()`. Tüm Server Action'lar mağaza kapsamını denetler.
- **`/panel/pages`:** ana sayfa en üstte sabit. Dil başına durum, son düzenleyen, önizleme.
- **`/panel/pages/[id]/edit?locale=de`:** tam ekran (P2), Puck.
  - **Sol:** kategoriler (Düzen, İçerik, Bölümler, Ürün verisi, Formlar, Kayıtlı bölümler) + anahat.
  - **Sağ:** İçerik / Stil / Gelişmiş.
  - **Kanvas:** kısa metinler için `contentEditable`. Zengin metin için `richtext` `contentEditable` + `renderInlineMenu`.
  - **Üst çubuk** (`overrides.headerActions`): Kaydet, Önizle, Yayınla, Zamanla, Revizyonlar, Dil.
- **Editör iframe'i:**
  - Yüklenecekler: `site.css`, `fonts.css`, tema değişkenleri ve canlı kapsamlı CSS.
  - `site.js` **çalıştırılmaz**. `<html>`'e `js` sınıfı eklenmez, yoksa `[data-reveal]` öğeleri görünmez kalır.
  - Bloklar `puck.isEditing` iken animasyonları ve bağlantı gezinmesini kapatır.
- **Otomatik kayıt:**
  - Gecikmeli (ör. 1,5 sn) ve en fazla dakikada N istek.
  - `version` ile iki admin çakışma uyarısı.
  - Faz 0 ölçümüne göre tipik ana sayfa belgesi ~55 KiB (sınırın %5'i), 3 katı stres belgesi ~165 KiB. Server Action yeterli. Belge sınırı 1 MB olarak kalır ve gövde sınırıyla aynı. Route Handler'a geçmek yalnızca sınıra yaklaşılırsa gerekir.
  - **Tıkla-ekle:** Puck 0.23'te çekmeceden yalnızca sürükleme var. İstenirse `overrides.drawerItem` + `dispatch({ type: "insert", … })` ile eklenebilir (`PuckAction` içinde `insert` mevcut). Ayrı bir alan bileşeni gerekmez.

### 5.7 Yayın, önbellek, önizleme

- **Yayınla:**
  - `migrate()` + `schemaVersion` yükseltme
  - Zod doğrulama ve temizleme
  - Erişilebilirlik kontrolleri (5.11)
  - `published = draft`, `publishedCss` ve `usedFonts` üretimi
  - `PageRevision` kaydı
  - Proxy sayfa listesinin geçersiz kılınması (5.8)
- **Önbellek (v1):** Sayfa ve veri önbelleği yok. Sebepler: kök layout dinamik, Prisma sorguları küçük, ürün ve fiyat her zaman canlı. TTFB ölçülür. Gerekirse ayrı bir iş olarak proje genelinde Cache Components (`use cache`, `cacheTag`, `updateTag`) açılır. Hafızadaki Next 16 notlarında bilinen tuzaklar listeli. `unstable_cache` kullanılmaz (Next 16'da yerini `use cache` aldı).
- **Zamanlanmış yayın:** mevcut `/api/cron/notifications` deseni (CRON_SECRET) ile ayrı bir iş veya aynı iş listesine ekleme.
- **Önizleme:**
  - Panelde "Önizle" → `/[locale]/...` yerine özel bir önizleme route'u (ör. `/panel/pages/[id]/preview?locale=`). Taslağı `SiteFrame` içinde render eder; `noindex` + `X-Robots-Tag`.
  - Paylaşılabilir bağlantı: imzalı, süreli, tek sayfaya bağlı token. Global `draftMode()` kullanılmaz; o çerez tüm taslakları açar.

### 5.8 Yönlendirme (düzeltilmiş)

- **Route:** `app/[locale]/(pages)/[[...slug]]/page.tsx`. `locale`, mağazanın dillerinden biri değilse veya sayfa yoksa `notFound()`.
- **Neden fallback değil:** Dinamik route fallback'ten önce eşleşir (Next 16 proxy belgesindeki yürütme sırası). Bu yüzden:
  - **`proxy.ts`**, istek mağazası için **yayındaki sayfa listesini** bilir: `slug`, diller, yönlendirmeler.
  - **Öneksiz istek** (`/black-friday`, `/`): sayfa varsayılan dilde yayındaysa `/{defaultLocale}/black-friday`'e rewrite edilir. Yoksa dokunulmaz (legacy rewrite / 404 akışı aynen devam eder).
  - **Önekli istek** (`/en/black-friday`): dinamik route zaten eşleşir. Proxy yalnızca ana sayfa için devreye girer: `/en` yayındaysa legacy `index` yerine oluşturucuya gider.
  - **Eski slug** → `PageRedirect` ile 301.
- **Liste önbelleği:** Proxy her istekte veritabanına gitmemeli. Süreç içi önbellek (mağaza başına, ör. 30 sn TTL) kullanılır; yayın aynı süreçte listeyi hemen geçersiz kılar. Birden fazla örnek çalışıyorsa en fazla TTL kadar gecikme olur, bu kabul edilir.
- **Slug kuralları:** küçük harf `a-z0-9-` ve `/` ile ayrılmış segmentler. Şunlar ayrılmıştır:
  - `en`, `tr`, `de`
  - `products`, `blog`, `imprint`, `privacy`, `terms`, `cookies`
  - `account`, `auth`, `panel`, `api`, `assets`, `legacy`, `newsletter`, `_next`
  - Panelin özel adresi
  - Hâlâ legacy olan statik sayfa slug'ları (`about`, `pricing`, `themes`…)

  Ayrılmış listeden bir slug seçilirse uyarı verilir; v1'de bunlar engellenir.
- **Bakım modu:** `proxy.ts` önce bakım kontrolünü yapar (mevcut sıra korunur), sonra oluşturucu rewrite'ı.
- **Site haritası ve hreflang:** `app/sitemap.ts` yayındaki sayfaları ekler. Ana sayfanın bazı dilleri oluşturucuda, bazıları legacy'de olabilir; `languageAlternates` her dilin gerçekte yayında olan URL'sini vermeli.

### 5.9 Eski ana sayfa eşdeğerlik listesi (Faz 3 kabulü)

Legacy route'un (`app/legacy/[locale]/[slug]/route.ts`) yaptıkları oluşturucu ana sayfasında da olmalı:

| Legacy davranış | Oluşturucuda karşılığı |
|---|---|
| `injectCatalog` (ürün grid'i, `data-product`, sektör filtresi) | ProductGrid bloğu (canlı veri + filtre istemci bileşeni) |
| `injectTestimonials` | Testimonials / ReviewList bloğu |
| `trackPageView(storeId, "index")` | Ana sayfa için **aynı anahtar `index`**, istatistik sürekliliği için. Diğer sayfalar `page-<slug>` |
| `localizeLegacyHtml` (de/en/tr çeviriler) | Dil başına belge. İçerik `i18n/legacy/*`'dan aktarılır |
| Bülten formu `data-consent-version` | Newsletter bloğu `getLegalSettings(storeId).privacyVersion` kullanır, mevcut `/api/newsletter` |
| Hesap menüsü, bakım uyarısı (yöneticiye) | `SiteFrame` zaten yapıyor |
| `addLegacySeo` (meta, OG, JSON-LD, SEO ayarları) | `generateMetadata` → `pageMetadata()`, `custom-metas`, Organization/WebSite JSON-LD |
| `Content-Language`, `Vary: Cookie`, oturumluyken `Cache-Control: private, no-store` | Sayfa ve route başlıkları aynı şekilde |
| `data-reveal` animasyonları, SSS, kopyala butonları | İstemci bileşenleri (5.10) |
| Reveal geçidi (`<html class="js">`) | React tarafında gerekmez; Reveal bileşeni kendi durumunu yönetir |

Kabul ölçütü: önce/sonra ekran görüntüsü karşılaştırması (masaüstü, tablet, mobil × de/en/tr). Lighthouse performans ve erişilebilirlik skorları legacy'den düşük olmamalı. Oturumlu ve oturumsuz ziyaretçide başlıklar aynı olmalı.

### 5.10 Etkileşim

- **Animasyonlar ve davranışlar `site.js`'e bırakılmaz.** `Reveal` (IntersectionObserver), Accordion (veya `<details>`), ProductFilter, CopyButton, NewsletterForm küçük **istemci bileşenleridir**.
- **`prefers-reduced-motion`:** Reveal hiç gizlemez. Gezinme sonrası yeni gelen bloklar da doğru çalışır.
- **`SiteFrame` `site.js`'i yüklemeye devam eder** (header, menü vb. için). Oluşturucu blokları `data-reveal` gibi `site.js` kancalarını **kullanmaz**, yoksa iki sistem aynı öğeyi yönetir.

### 5.11 Erişilebilirlik

- Almanya'da **BFSG** 28.06.2025'ten beri B2C online satış yapan siteleri kapsıyor. Hizmet sunan **Kleinstunternehmen** (<10 çalışan ve ≤2 M € ciro/bilanço) muaf. Uygulanabilirlik kontrol edilmeli; hedef her durumda **WCAG 2.1 AA**.
- **Yayın öncesi kontroller:**
  - Kritik (yayını engeller): tek H1, başlık sırası atlanmıyor, görselde alt metin veya "süs" işareti, boş bağlantı metni yok.
  - Uyarı: metin/arka plan kontrastı (serbest renkler nedeniyle), <12 px font, mobilde gizlenen içeriğin karşılığı.
- **Eleman dili (`lang`):** WCAG 3.1.2 "bölümlerin dili" ile doğrudan örtüşür.
- **Alt metinler dil başına:** `MediaAsset.alt` tek dilli. Görsel seçilince alt metin oradan **önerilir**, ama sayfa belgesinde dil başına saklanır.
- **Diğer:** odak görünürlüğü, klavye ile erişilebilir accordion ve filtre, video için altyazı alanı.

### 5.12 Gömülü içerik ve onay

- **YouTube, Vimeo, Google Maps:** iki tıklamalı gömme. Önce yerel önizleme görseli ve açıklama gösterilir, tıklanınca iframe yüklenir. Seçim isteğe bağlı olarak `localStorage`'da hatırlanır.
- **Yasal metinler:** Çerez ve gizlilik metinleri (`lib/legal-copy.ts`) bu sağlayıcılar için güncellenmeli. Mevcut metin, yeni üçüncü taraf eklenmeden önce yeniden değerlendirme şart koşuyor.
- **Sınır:** Başka sağlayıcı veya ham HTML gömme yok.

### 5.13 Güvenlik

- **Doğrulama:** Sunucuda Zod ile blok ve stil bazında; bilinmeyen blok veya alan reddedilir; belge ≤1 MB. Faz 0 prototipine göre Faz 1'de eklenecekler:
  - **`root` doğrulaması:** prototipte `root: z.unknown()`. Kök alanlar (sayfa ayarları, varsa kök slot'lar) da şemaya bağlanmalı.
  - **Slot alanları açıkça listelenmeli:** prototipte dizi olan her alan iç içe blok sayılıyor. SSS maddeleri, özellik listesi gibi `array` alanlı bloklar eklenince bu hatalı sonuç verir. Her bloğun şemasında slot alan adları (`slots: ["content"]` gibi) tanımlanır; doğrulama, temizleme, CSS derleme ve kimlik yenileme yalnızca bunları gezer.
  - **Kimlikler:** `ID_PATTERN` hem doğrulamada hem CSS derlemede uygulanıyor. Bu sayede `[data-pb="<id>"]` seçicisinden enjeksiyon kapalı; korunmalı.
- **Bağlantılar:** `https:`, `mailto:`, `tel:`, site içi yol, `#id`. `javascript:` ve `data:` reddedilir. Dış bağlantılara `rel="noopener"`.
- **Zengin metin:** `richtext` değeri **HTML dizesi** olarak saklanıyor. `<Render>` bu HTML'i **olduğu gibi** basıyor; Faz 0 deneyinde `onerror`, `<script>` ve `javascript:` aynen çıktı (`tests/page-builder-document.test.ts`). Render bir savunma katmanı değil. Kurallar:
  - **Tek yazma yolu:** Her yazma yolu (editör kaydı, yayın, revizyon geri alma, MCP, yapay zekâ, yedekten geri yükleme) `lib/page-builder/pages.ts` içindeki tek bir fonksiyondan geçer: doğrula → temizle → yaz. Prototipte temizleme yalnızca kaydetme eyleminde.
  - **Yayında yeniden temizleme:** `published` her zaman temizlenmiş belgedir.
  - **Temizleyicide `lang`:** Temizleyici `lang` özniteliğine izin vermeli: `p`, `span`, `blockquote`, `li`, `h2`–`h4`, BCP 47 kontrolüyle. Prototipteki `"*": []`, karar 2'deki metin içi dil işaretlemesini (`<span lang="en">`) siliyor.
  - **Zengin metinde H1 yok:** Zengin metin `heading: { levels: [2, 3, 4] }` ile sınırlanmalı, temizleyicide de `h1` bulunmamalı. Tek H1 kuralı Heading bloğuyla sağlanır. Prototipte `h1`–`h6` izinli; `center` gibi eski etiketler de izin listesinden çıkarılmalı.
  - **Editörde dil işareti (Faz 1):** Temizleyici ve render `lang`'ı koruyor. Ancak Puck'ın Tiptap editörü bilinmeyen öznitelikleri yükleme sırasında atar. Editörde metnin bir kısmına dil vermek ve korumak için bir Tiptap mark uzantısı (`span[lang]`, `tiptap.extensions`) ve menü kontrolü (`renderMenu` / `RichTextMenu.Control`) gerekiyor. Bu, yalnızca istemci config'ine eklenir; render buna ihtiyaç duymaz.
- **Medya:** Yalnızca aynı mağazanın `MediaAsset` kayıtları seçilebilir.
- **Önizleme token'ı:** imzalı (BETTER_AUTH_SECRET türevi), süreli, tek sayfaya ve dile bağlı.

### 5.14 Görseller ve performans

- **Görsel çıktısı:** `MediaAsset.width/height` her `<img>`'e yazılır (CLS önlenir). Hero görseli `fetchpriority="high"`, altındakiler `loading="lazy"`.
- **LCP için hero:** Arka plan görseli CSS ile verilirse LCP ve alt metin kaybolur. Bu yüzden hero ve Section `image` varyantı görseli `<img>` (object-fit) katmanı olarak basar.
- **`next/image`:** Projede yapılandırılmamış, mevcut sayfalar `<img>` kullanıyor. v1'de `<img>` + boyutlar yeterli. Çok boyutlu varyantlar ayrı bir iş.
- **Editör kodu herkese açık sayfaya girmemeli:** build analiziyle doğrulanır (Faz 0 kabulü).

### 5.15 Entegrasyonlar

- **Medya kullanımı:** `lib/media-usage.ts` → `getEmbeddedUsage` `pages` sayacı alır. `mediaKeysIn(JSON.stringify(draft + published))` yeterli; alternatif `walkTree`. Kullanılan medya silinemez uyarısı sayfaları da kapsar.
- **Yedekleme:** `Page*` tabloları `lib/backup.ts` + `lib/backup-validation.ts` (sıkı şemalar) içine eklenir. Geri yüklemede `MediaAsset` kimlikleri yeniden eşlenir.
- **MCP:** `pages_list`, `page_get`, `page_update_draft`, `page_publish` (yayın admin onayıyla). Blok şemalarından `z.toJSONSchema` ile araç şeması üretilir.
- **Yapay zekâ (Faz 4):**
  - Çeviri yalnızca metin alanlarını değiştirir; yapı ve stil korunur.
  - Bölüm taslağı üretimi şemayla doğrulanır.
  - OpenRouter (`lib/openrouter.ts`). Puck AI (bulut) kullanılmaz.

### 5.16 Kod yapısı

**Kural (Faz 0'da kanıtlandı):** Herkese açık route'un içe aktarma zincirine **editör tarafı** istemci modülleri girmemeli: Puck arayüzü, alan bileşenleri, Tiptap, dnd-kit. Next 16, route'un istemci parçalarını HTML'e `<script>` olarak basıyor. Prototipte bu ayrım yapılmadan `/pb` 506 KB'lık Puck parçasını yüklüyordu.

Küçük etkileşim adacıkları (`interactive/`: Reveal, Accordion, ProductFilter…) herkese açık sayfada bilinçli olarak yer alır. Bunlar `@puckeditor/core` veya editör kodundan hiçbir şey içe aktarmaz. Bu yüzden:
- **Alan tanımları ikiye ayrılır:** istemcisiz temel tanımlar (`fields.server.ts`) ve editör alanları (`block-fields.tsx`, `style/fields.tsx`).
- **İçe aktarma sınırı:** `config.server.tsx` yalnızca istemcisiz modülleri içe aktarır. `Render`, `@puckeditor/core` paketinin `react-server` girişinden gelir.
- **Kontrol:** Yeni bir blok eklerken bu ayrım bozulmamalı. Faz 1'de bir test veya build kontrolü bunu yakalamalı (ör. public route manifestinde `puck`/`tiptap`/`dnd-kit` olmamalı).

```
lib/page-builder/
  blocks/<Block>/{schema.ts, render.tsx}   # sunucu tarafı; editör alanları block-fields.tsx'te
  fields.server.ts             # istemcisiz alan tanımları (config.server.tsx için)
  block-fields.tsx             # editör alanları ("use client")
  interactive/                 # Reveal, Accordion, ProductFilter, CopyButton, NewsletterForm, ConsentEmbed ("use client")
  style/{schema.ts, css.ts, fields.tsx}
  theme.ts                     # mağaza teması → mevcut site.css değişkenleri
  fonts.ts                     # kullanılan fontlar → preload listesi
  config.server.tsx            # <Render>
  config.client.tsx            # <Puck>
  fields/                      # MediaPicker, ProductPicker, LinkField, IconPicker, ColorField, FontField
  migrations.ts                # schemaVersion + Puck migrate() + transformProps
  validate.ts                  # belge doğrulama, temizleme, erişilebilirlik kontrolleri
  pages.ts                     # okuma, yazma, yayın, revizyon, slug kuralları
  registry.ts                  # proxy için yayındaki sayfa listesi (süreç içi TTL önbellek)
app/panel/pages/               # liste, ayarlar
app/panel/pages/[id]/edit/     # tam ekran editör (P2)
app/panel/pages/[id]/preview/  # taslak önizleme
app/[locale]/(pages)/[[...slug]]/page.tsx
public/assets/css/pb-blocks.css            # blok temel stilleri (site.css'e ek)
```

Otomatik kayıt Server Action ile yapılır (Faz 0 ölçümü: tipik belge ~55 KiB). Belge 1 MB sınırına yaklaşırsa Route Handler'a geçilir.

Faz 0 prototip dosyaları (`app/pb`, `app/pb-edit`, `lib/page-builder/prototype-store.ts`, `.temp_files/page-builder/`) Faz 1'de `/panel/pages` ve veritabanı yazma yoluyla değiştirildiğinde kaldırılır.

---

## 6. Eklenecek paketler

| Paket | Neden | Not |
|---|---|---|
| `@puckeditor/core` **0.23.0** (tam sürüm) | Editör, Render, migrate | `no-external.css`; Tiptap ve dnd-kit kopyalarını kontrol et |
| `isomorphic-dompurify` veya `sanitize-html` | HTML temizleme (P3) | Blog için de |
| (Opsiyonel) `react-colorful` | Renk seçici | Native `<input type="color">` + HEX alanı da olur |

Projeye ayrıca dnd-kit **eklenmemeli** (Puck 0.4.0'a sabit).

---

## 7. Fazlar ve tamamlanma ölçütleri

Boyutlar göreli: S küçük, M orta, L büyük.

### Faz 0: Doğrulama prototipi (S)

Kapsam: Puck kurulumu, tek sayfa, Container + Grid (`inline`) + Heading + Text, Stil sekmesinden tipografi ve boşluk, `<Render>`.

Doğrulanacaklar (her biri için sonuç Faz 1'den önce bu belgeye yazılır):
1. `richtext` alanının saklama formatı (HTML/JSON) ve sunucu render yolu → temizleme tasarımı.
2. `pnpm why @tiptap/pm` ve `@dnd-kit/*`: tek kopya mı?
3. `happy-dom` / `@tiptap/html` sunucu paketinde sorun çıkarıyor mu, `serverExternalPackages` gerekiyor mu?
4. Herkese açık sayfa JS paketinde editör kodu var mı (build analizi)?
5. Editör iframe'inde `site.css` ve fontlar, `site.js` olmadan doğru görünüm.
6. `inline` grid çocuklarında sürükle-bırak ve `data-pb` kapsamlı CSS (masaüstü/tablet/mobil).
7. `<Render>` çıktısında Puck sarmalayıcıları var mı, `data-pb` seçicileri etkileniyor mu?
8. `panel.css` genel kuralları (`button`, `h1,h2,p` margin vb.) Puck arayüzünü bozuyor mu?
9. Örnek bir ana sayfa belgesinin JSON boyutu ve otomatik kaydın 1 MB sınırına uzaklığı.

**Faz 0 sonuçları (26 Ekim 2026, prototip `/pb` + `/pb-edit`):**

1. **richtext — HTML dizesi olarak saklanır.** Panelde tiptap alanı devreye girdi; "Layer test 2026." ekinden sonra Publish edildiğinde değer JSON'da `<p>…<code>…</code>… Layer test 2026.</p>` biçiminde kaydedildi (tipografik uzantılar çalışıyor; em-dash tiptap tarafından normalleştirildi, kayıt değeri olarak not edildi). Sunucuda render mevcut `<Render>` text yolu; temizleme tasarımı Faz 1'de HTML sanitizer (izinli etiket listesi, `javascript:` reddi) bu formatın üstüne kurulacak.
2. **Tek kopya ✓.** `pnpm why @tiptap/pm` → tek sürüm 3.31.3; `@dnd-kit/*` yeni nesil (0.4.0 ailesi) tek sürüm; happy-dom 20.14.6 ve `@tiptap/html` 3.32.0 tek kopya.
3. **Sunucu paketi sorunsuz ✓.** `happy-dom` + `@tiptap/html` (Puck'ın kendi richtext bağımlılık zinciri üzerinden) Node runtime'da Next 16 build'ini bozmuyor, `/pb` 200 dönüyor; `serverExternalPackages` gerekmedi.
4. **Herkese açık paket temiz ✓.** Public route grafiğine hiç `"use client"` modülü girmiyor: `lib/page-builder/fields.server.ts` (client-free temel alan tanımları) → `config.server.tsx`; `style` özel alanı ve diğer client alanlar `block-fields.tsx` + `config.client.tsx` içinde kalıyor. Produksiyon build analizinde `/pb` manifesti 11 modül / toplam ~97 KB chunk ve editör marker'ları yok (`prototype-editor`, `pbstyle`, `tiptap`, `dnd-kit`, `puck-*`); editör modülleri yalnız `/pb-edit` paketinde (~1.1 MB toplam, en büyük chunk 508 KB). Not: Next 16 her route'un client chunk'larını public HTML'e `<script>` olarak bastığı için bu ayrım fields split'i olmadan mümkün değildi (düzeltmeden önce `/pb` HTML'i 506 KB'lık Puck chunk'ını yüklüyordu).
5. **Editör iframe ✓.** Canvas iframe'i yalnız `fonts.css`, `site.css` ve `pb-blocks.css` yükler; `site.js` hiç yüklenmez; host dokümanına `site.css` sızmıyor (`syncHostStyles: false`). Manrope woff2 + preload gerçek, 56px/800 hero başlığı iframe'de doğru görünüyor.
6. **Inline grid sürükle-bırak ve kapsamlı CSS ✓.** Sidebar → root ve sidebar → boş sütun (`grid-features:col3`) pointer sürüklemesi çalışıyor; col3'e bırakılan başlık JSON'da sütun slotunda (props.col3 dizisi) kaydedildi ve Publish ile kalıcılaştı; test bloğu silinip temiz belge yeniden Publish edildi. Otomasyon notu: İlk denemelerin root'a düşmesinin nedeni motor bozukluğu değil koordinat hesabıydı — host koordinatı = `iframeRect.origin + localRect × scale` (Desktop 1440, ölçek ~0.4167); ölçek çarpımı eklendikten sonra boş slot kabul ediyor. Ayrıca Puck 0.23'te drawer'da click-to-add yok (yalnız sürükleme); Faz 1'de "boş sütuna tıkla ve Ekle" akışı istenirse ya manuel kullanım ya custom field ile eklenecek. Kapsamlı CSS üç kırılımda canlı: Tablet sekmesi canvas'ı 768'e alıyor ve tablet 40px uygulanıyor; Mobile → 390 ve 30px; hero mobil kırılımı 767.98'de 34px / -1.02px. Kayıt: `pb-grid--2` mobilde 2 kolon kalıyor, yalnız 3/4 sütunlu varyantlar tek kolona yığılıyor — Faz 1'de tasarımcı kararı olarak netleştirilecek.
7. **`<Render>` çıktısı temiz ✓.** Public alanda Puck frame/wrapper sınıfı yok (`hasPuckWrappers: false`); `data-pb` kapsamları beklenen seçici hedefleriyle eşleşiyor.
8. **`panel.css` zararsız ✓.** Genel kurallar Puck arayüzünü bozmadı (referans ekran görüntüsü `.temp_files/pb-edit-desktop.png`).
9. **Belge boyutu — geniş marj ✓.** Örnek ana sayfa belgesi (14 üst düzey bölüm, 114 toplam blok: hero + 8 bölümün 2 sütunlu kart grid'leri + 2 uzun metin bloğu ve 2 adet 3 sütunlu grid) mevcut prototip kayıt formatında (`JSON.stringify(doc, null, 2)`) **56.216 bayt ≈ 54,9 KiB = 1 MB sınırının %5,36'sı**; boşta ~969 KiB var. Faz 1 otomatik kayıt (Route Handler gövdesi) için minified tahmin ~19,8 KiB. 3× stres belgesi (42 bölüm / 342 blok) 164,9 KiB = %16,1 — sınırın hayli altında; `writePrototypeDocument` 1 MB üstünü zaten reddediyor ve Faz 1'de Zod doğrulaması aynı sınırı devralacak.

**Faz 0 incelemesi (26 Ekim 2026):** Sonuçlar kod ve kurulu paketlerle karşılaştırıldı.

- **Doğrulananlar:**
  - Tiptap tek kopya (`@tiptap/core` ve `@tiptap/pm` 3.31.3, `@tiptap/html` 3.32.0); dnd-kit tek aile (0.4.0); `happy-dom` 20.14.6.
  - `@puckeditor/core` 0.23.0 ve `sanitize-html` 2.18.1 tam sürüm sabitli.
  - `@puckeditor/core` paketinde `react-server` dışa aktarma koşulu var (`dist/rsc.mjs`); sunucu/istemci ayrımı bu sayede çalışıyor.
  - `iframe.syncHostStyles` gerçek bir Puck seçeneği.
  - Blok kimlikleri hem doğrulamada hem CSS derlemede `ID_PATTERN` ile denetleniyor.
  - `walkBlocks` slot içindeki blokları da geziyor.
  - Boyut hesapları doğru: 56.216 B / 1.048.576 B = %5,36.
- **Plana göre sapma ve eksikler** (Faz 1 işlerine eklendi):
  1. **Kırılım noktaları:** Prototip 1023.98/767.98 kullanıyor, plan ve `site.css` 900/620 (5.3). Sonuç 6'daki "tablet 768, mobil 767.98" ölçümleri bu yüzden `site.css` ile uyumsuz. Hizalanmalı.
  2. **`/pb` canlıda açık:** `app/pb/page.tsx` `prototypeEnabled()` kontrolü yapmıyor. Yorum "production'da 404" dese de canlıda varsayılan demo belgesi herkese açık render edilir. `/pb-edit` doğru korunuyor (geliştirme ortamı + `requirePanelUser`). Prototip canlıya çıkmadan `/pb`'ye de aynı kontrol eklenmeli veya prototip kaldırılmalı.
  3. **XSS sınırı tek noktada:** Temizleme yalnızca prototipin kaydetme eyleminde. Tek yazma yolu kuralı için bkz. 5.13.
  4. **`lang` ve H1:** Temizleyici `lang`'ı siliyor, `h1`'e izin veriyor (5.13).
  5. **Doğrulama açıkları:** `root` doğrulanmıyor; dizi alanlar slot sayılıyor (5.13).
  6. **Sonuç 6'daki "pb-grid--2 mobilde 2 kolon" kaydı:** Plan 5.2 bunu zaten çözüyor; Grid için tablet ve mobil sütun sayısı kullanıcı tarafından ayrı seçilir. Tasarımcı kararı gerekmez, varsayılan "mobilde 1 sütun" olur.
  7. **Tıkla-ekle:** Varsayılan arayüzde yok ama `insert` eylemiyle yapılabilir (5.6).
  8. **Kod yorumları:** Prototip kodundaki "plan 4.x" atıfları 1. sürüm bölüm numaralarına aitti.
  9. **Render temizlemiyor (yeni bulgu):** `text/render.tsx` yorumu Puck'ın render'da temizlediğini ima ediyordu. Deneyle yanlış olduğu görüldü: `<Render>` saklanan HTML'i aynen basıyor.

- **Tamamlananlar (26 Ekim 2026):**
  - **Kırılımlar:** `style/css.ts` → `BREAKPOINT_WIDTHS = { tablet: 900, mobile: 620 }`; `BREAKPOINTS`, `deviceForViewport` ve `pb-blocks.css` bundan türetildi. Editör viewport'ları 1440/768/390.
  - **Grid:** Mobilde (≤620) tüm varyantlar varsayılan olarak tek sütun; tablette (≤900) 4 sütun → 2.
  - **`/pb`:** `prototypeEnabled()` kontrolü eklendi, canlıda 404.
  - **Tek kapı:** `lib/page-builder/document.ts` → `prepareDocument` (boyut, JSON gidiş-dönüş, doğrulama, temizleme; girdiyi değiştirmez) ve `renderableDocument`. `prototype-store.ts` yalnızca bunlar üzerinden okur ve yazar; `/pb` render öncesi yeniden temizler.
  - **Temizleyici:** `lang` (BCP 47 doğrulamalı) izinli. H1 → H2, H5/H6 → H4, `center` → `p` (metin kaybolmaz). `q`, `cite` eklendi. Zengin metin alanı `heading.levels: [2, 3, 4]`.
  - **Doğrulama:** `lib/page-builder/slots.ts` blok başına slot alanlarını listeler; doğrulama, gezinme, temizleme ve CSS derleme yalnızca bunları gezer. `root` yalnızca `props.title` kabul eder; boş olmayan `zones` reddedilir; tekrar eden blok kimlikleri reddedilir.
  - **Kod yorumları:** atıflar 5.x'e güncellendi; `text/render.tsx` ve `sanitize.ts` yorumları düzeltildi.
  - **Testler:** `tests/page-builder-document.test.ts` (12 test). Kapsamı: kırılımlar, viewport → cihaz eşlemesi, temizleyici (`lang`, başlıklar, XSS), kök/bölge/kimlik doğrulaması, slot gezinmesi, tek kapı, zararlı belgenin `<Render>`'dan temiz çıkması, herkese açık route'un içe aktarma zincirinde istemci veya editör modülü olmaması. `pnpm test:page-builder` → 23/23.

### Faz 1: Çekirdek (L) — TAMAMLANDI ✅

- **Önkoşullar:** P1 (en azından oluşturucu sayfaları için), P2, P3 (blog tarafı).
- **Faz 0'dan kalanlar:**
  - Prototip route'ları ve dosya deposu kaldırılır, yerine `/panel/pages` + veritabanı gelir. `document.ts` tek kapı olarak aynen kullanılır.
  - Editörde dil işareti (Tiptap mark + menü, 5.13).
  - Blog içeriğine aynı temizleyici (P3).
  - Herkese açık route testi (`tests/page-builder-document.test.ts` sonu) yeni route'ları da kapsayacak şekilde genişletilir.
- **Modeller ve route'lar:** Prisma modelleri ve migration, `/panel/pages`, editör, otomatik kayıt (Route Handler), yayın, revizyon, önizleme (token), proxy yönlendirmesi + sayfa listesi, slug kuralları, 301'ler, `pageMetadata`, site haritası.
- **Düzen:** Container, Section, Grid, Stack, Spacer, Divider.
- **İçerik:** Heading, Text, Button, Image, Video (iki tıklamalı), Icon, List.
- **Stil paneli:** tam, duyarlı; kapsamlı CSS üretimi, font preload listesi.
- **Dil:** eleman dili, "başka dilden kopyala".
- **Kontroller:** erişilebilirlik kontrolleri, Zod doğrulama, temizleme, medya kullanımı, yedekleme.
- **Tamamlanma ölçütleri:**
  - Testler yeşil (bölüm 8).
  - Başka mağazanın sayfası ve medyası erişilemez.
  - Admin olmayan reddedilir.
  - Yayından kaldırınca legacy'ye dönüş çalışır.

### Faz 2: Bölümler, veri, tema (M)

- **Bölümler:** Hero, FeatureGrid, Stats, LogoCloud, Testimonials, FAQ, CTA, ComparisonTable, Steps, Newsletter, Contact (reCAPTCHA mevcut `lib/recaptcha.ts`).
- **Veri blokları:** ProductGrid (+ filtre), ProductSpotlight, PricingTable, ReviewList, LatestPosts.
- **Tema ve alanlar:** mağaza teması (Settings → Görünüm), `ProductPicker`, `LinkField`.
- **Tamamlanma ölçütü:** ürün ve fiyat değişikliği yayın gerektirmeden sayfaya yansır.

### Faz 3: Ana sayfa (M)

- Proxy ana sayfa devralma (mağaza ve dil başına).
- TYPO3 mağazası ana sayfası 5.9 listesine göre kurulur, de/en/tr içerik aktarılır.
- Global mağaza için şablondan İngilizce ana sayfa (P1 gerekli).
- **Tamamlanma ölçütü:** 5.9 kabul ölçütleri sağlanır.

### Faz 4: Verimlilik (M)

Kayıtlı bölümler ve şablonlar, zamanlanmış yayın, revizyon karşılaştırma ve geri alma, stil kopyala/yapıştır, yapay zekâ çeviri ve taslak, font yöneticisi (sayfa bazlı preload), MCP araçları.

### Faz 5: İsteğe bağlı

Diğer statik sayfaların taşınması, A/B, CTA analitiği, Cache Components geçişi.

---

## 8. Test planı

- **Birim:**
  - Blok ve stil şemaları (CSS enjeksiyonu, `javascript:` bağlantı, aşırı değerler)
  - Stil → CSS (kırılım sırası, kapsam, çakışmayan kimlikler)
  - Font listesi çıkarımı
  - Slug kuralları ve ayrılmış slug'lar
  - `migrate` / `transformProps`
  - Temizleyici: `lang` korunur; `h1`, `script`, `on*` öznitelikleri, `javascript:` ve `style` silinir
  - `lang` (BCP 47)
  - Kırılım noktaları: derlenen CSS'te yalnızca `max-width: 900px` / `620px`
  - Herkese açık route'ta editör modülü yok: build manifestinde `puck`/`tiptap`/`dnd-kit` yok, yalnızca `interactive/` adacıkları (5.16)
  - Erişilebilirlik kontrolleri (H1, alt metin, kontrast)
- **Entegrasyon (izole şema, `tests/*.integration.test.ts` deseni):**
  - Yayın → revizyon → sayfa listesi geçersiz kılma
  - Dil başına durum
  - Mağaza izolasyonu
  - Admin olmayan reddi
  - 301 yönlendirme
  - Ana sayfa devralma ve geri dönüş
  - Medya kullanım sayımı
  - Yedekleme ve geri yükleme
- **Yönlendirme:** `proxy` birim testleri.
  - Öneksiz yayınlanmış slug → rewrite; yayınlanmamış → dokunulmaz.
  - `/black-friday` asla `locale` olarak yakalanmamalı.
- **Uçtan uca (agent-browser):** blok sürükle, mobilde ayrı stil ver, kaydet, yayınla, canlıda doğrula; istemci tarafı gezinmeden sonra içerik görünür (reveal); iki tıklamalı video; klavye ile SSS.
- **Görsel karşılaştırma:** Faz 3 ana sayfası, legacy ile yan yana ekran görüntüleri.

---

## 9. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Puck 0.x API değişikliği | Yükseltmede kırılma | Tam sürüm sabitleme, `migrate`/`transformProps`, yükseltme testi |
| Serbest stil → tutarsız ve erişilemez sayfalar | Marka ve yasal risk | Tema hızlı seçimi, kontrast uyarısı, yayın öncesi kontroller, "stili sıfırla" |
| P1 (mağazaya duyarlı dil) gecikirse | Global mağaza ana sayfası öneksiz İngilizce çalışmaz | Faz 1'de en azından oluşturucu yolu için çöz |
| Proxy'de veritabanı yükü | Her istekte gecikme | Süreç içi TTL önbellek, yalnızca oluşturucu yolu adayı isteklerde sorgu |
| `site.js` ile çift yönetim | Görünmeyen içerik | Bloklarda `site.js` kancası yok, istemci bileşenleri |
| Gömmeler ve onay | GDPR ihlali | İki tıklama + yasal metin güncellemesi |

---

## Kaynaklar

- Puck:
  - [Başlangıç](https://puckeditor.com/docs/getting-started)
  - [Server Components](https://puckeditor.com/docs/integrating-puck/server-components)
  - [Çok sütunlu düzen ve `inline`](https://puckeditor.com/docs/integrating-puck/multi-column-layouts)
  - [Bileşen config (`inline`, `dragRef`, `isEditing`, `resolveFields`)](https://puckeditor.com/docs/api-reference/configuration/component-config)
  - [AppState (`ui.viewports`)](https://puckeditor.com/docs/api-reference/app-state)
  - [walkTree](https://puckeditor.com/docs/api-reference/functions/walk-tree)
  - [Veri taşıma (`transformProps`)](https://puckeditor.com/docs/integrating-puck/data-migration)
  - [migrate](https://puckeditor.com/docs/api-reference/functions/migrate)
  - [Richtext](https://puckeditor.com/docs/api-reference/fields/richtext)
  - [Text / contentEditable](https://puckeditor.com/docs/api-reference/fields/text)
  - [Slot](https://puckeditor.com/docs/api-reference/fields/slot)
  - [Dış veri](https://puckeditor.com/docs/integrating-puck/external-data-sources)
  - [Stil](https://puckeditor.com/docs/integrating-puck/styling)
  - [0.21'e geçiş](https://puckeditor.com/blog/upgrading-to-puck-021)
  - [0.23'e geçiş](https://puckeditor.com/blog/upgrading-to-puck-023)
- Craft.js [README](https://github.com/prevwong/craft.js/blob/main/packages/core/README.md)
- GrapesJS [Storage](https://github.com/grapesjs/grapesjs/blob/dev/docs/modules/Storage.md)
- Next.js 16 (projedeki yerel belgeler, `node_modules/next/dist/docs/01-app/03-api-reference/`):
  - `03-file-conventions/proxy.md` (yürütme sırası)
  - `05-config/01-next-config-js/rewrites.md` (fallback sırası)
  - `05-config/01-next-config-js/serverActions.md` (1 MB)
  - `04-functions/unstable_cache.md` (yerini `use cache` aldı)
  - `04-functions/updateTag.md`, `revalidateTag.md`, `draft-mode.md`
- BFSG:
  - [IHK Nord Westfalen](https://www.ihk.de/nordwestfalen/recht/internetrecht/barrierefreiheitsstaerkungsgesetz-6844448)
  - [Händlerbund: Kleinstunternehmen-Ausnahme](https://ohn.haendlerbund.de/recht/rechtsfragen/kleinstunternehmen-bfsg-ausnahme)
  - [e-recht24](https://www.e-recht24.de/ecommerce/13337-barrierefreiheit-online-shop.html)
- npm (26.10.2026):
  - `npm view @puckeditor/core@0.23.0 dependencies`
  - `npm view @puckeditor/core|@craftjs/core|grapesjs|@grapesjs/react|@dnd-kit/react version license peerDependencies`
- Proje kodu:
  - `app/legacy/[locale]/[slug]/route.ts`
  - `app/[locale]/_components/site-chrome.tsx`
  - `lib/legacy.ts` (reveal geçidi)
  - `lib/i18n/config.ts`
  - `lib/stores.ts`
  - `lib/media-usage.ts`
  - `app/panel/layout.tsx`
  - `proxy.ts`
  - `next.config.ts`
  - `public/assets/css/site.css` (kırılımlar ve değişkenler)
