# Headless sayfası yeniden tasarım

**Tarih:** 2026-09-27
**Kapsam:** `static-site/headless.html` ve `static-site/assets/css/site.css`
**Kaynak:** `static-site/build.py` (`headless` şablonu)

## Problem

`headless.html` yalnızca 3 bölümden oluşuyor ve sayfadaki tek içerik metin. Site
geri kalanında her sayfa görsel kullanıyor.

Somut kusurlar:

1. **Görsel yok.** Konu headless olmasına rağmen sayfa hiçbir kod, şema ya da
   görsel göstermiyor.
2. **`proof-grid` yanlış kullanılmış.** Grid `1.25fr .75fr` + 2 satır kaplayan
   `.proof-panel.large` için tasarlanmış (yani "1 büyük + 2 küçük"). Sayfa iki
   eşit kısa metin paneli koyuyor; sağ sütun boş kalıyor ve iki yalnız kutu
   gibi görünüyor.
3. **Sayfa ince ve yarım.** Kapanış CTA'sı yok; koyu bölümden sonra kesiliyor.
4. **2. bölüm jenerik.** `two-col` + `statement-list` düzeni `extensions.html`
   ve `about.html` sayfalarında da aynen kullanılıyor, ayırt edici değil.

Hedef: sayfayı ana sayfayla (`index.html`, 8 bölüm) aynı zenginlik ve bitiş
ritmine getirmek — ama içerik headless konusuna özgü olsun.

## Yaklaşım

Ana sayfanın bölüm yapısı ve bitiş ritmi korunur (koyu bölüm + callout +
kapanış CTA'sı). `headless`'in doğası gereği içerik **API sözleşmesi**
üzerine kurulur: JSON:API isteği/yanıtı, içerik modeli, dağıtım ve editör
deneyimi.

Tüm görsel ve metin varlıkları zaten mevcut olan CSS bileşenlerinden
oluşur. Yeni görsel dosyası gerekmez.

## Bölümler

### 1. Hero — API terminal paneli

Sol sütun (`hero-copy`) mevcut içeriği korur:

- eyebrow: `TYPO3 beyond templates`
- h1: `Content freedom.` / `Engineering clarity.`
- lead: mevcut metin
- buton: `Talk about a headless project` → `contact.html`
- `hero-proof` şeridi: `BUILT FOR` · `TYPO3 13 / 14 LTS` · `JSON:API` · `Content Blocks`

Sağ sütun (`hero-visual`) ana sayfadaki `.browser` yerine yeni bir koyu terminal
karti (`.hero-terminal`) gösterir:

- `hero-preview-tag` → `REFERENCE REQUEST / TYPO3 → FRONTEND`
- `code-head` → `GET /api/projects` + çalışan **Copy** butonu (`data-copy`)
- `pre.code` → gerçek biçimde JSON:API yanıtı. `.blue` ile istek satırı, `b`
  ile lime anahtarlar, `.code-comment` ile açıklama satırları.
- altında `proof-pills` → `JSON:API` · `Vary` · `Cache-Tags` · `Next.js`

### 2. `section` — Nerede işe yarar

`section_title('Where it fits', 'One backend. Many surfaces.', ...)`

`.article-grid` içinde 3 `.article-card`. Her kart: badge + h3 + metin +
`.proof-pills`.

| Badge | Başlık | pills |
|---|---|---|
| `EDITORIAL` | Kurumsal site | `Next.js` · `ISR` · `Preview` |
| `CLIENT WORK` | Ajans işi | `Multi-site` · `Design tokens` · `Handover` |
| `CHANNELS` | Çoklu kanal | `Web` · `App` · `Kiosk` |

### 3. `dark-section` — Sözleşme mimarisi

`proof-intro`: eyebrow `Reference architecture` + h2 **"The contract is the
product."** + kısa paragraf.

`proof-grid`:

- **`.proof-panel.large`** (ana bölümü kaplar)
  - `panel-top`: h3 "A content model the frontend can trust." + `01 / Contract`
  - `code-head`: `GET /api/projects?include=media` + Copy butonu
  - `pre.code`: JSON:API istek/yanıt örneği
  - `file-tree`: ContentBlocks yapılandırma ağacı
- **`.proof-panel`** — `02 / Delivery` → "Cache where it pays." → pills: `CDN` ·
  `Cache-Tags` · `Stale-While-Revalidate`
- **`.proof-panel`** — `03 / Editors` → "Editors never see the API." → pills:
  `Content Blocks` · `Workspace` · `Preview`

Bu, `.large` panelin ilk kez tasarlandığı amacıyla kullanıldığı yerdir.

### 4. `section-sm` — callout

İndigo `callout` bloğu (`assets/images/foundation-studio.webp` görseliyle):

- eyebrow: `Before you split`
- h2: **"Headless buys freedom. It costs a contract."**
- metin + `Discuss your architecture` butonu → `contact.html`

### 5. `section` — compare-table

`section_title('Decision', 'Template or headless?', ...)`

`.compare-table` — 3 sütun (alan, Template-based, Headless). Satırlar:

`Content ownership` · `Frontend freedom` · `Editor effort` · `Infrastructure` ·
`Best when`

### 6. `final-cta`

`build.py` içindeki mevcut `final_cta()` helper'ı aynen kullanılır.

## Uygulama

**Dosyalar:**

- `static-site/build.py` — `headless` şablonu. Sayfanın tek kaynağı budur;
  HTML elle düzenlenmez.
- `static-site/assets/css/site.css` — yeni `.hero-terminal` bloğu ve koyu
  bölüm/panel için mevcut sınıfların kullanımı. Başka yeni kural gerekmez.

**Yeni CSS:** `.hero-terminal` (+ içindeki `code-head` / `code` / `proof-pills`
alt öğeleri). Kart `var(--dark-2)` zemin, `#39444b` kenarlık kullanır; ana
sayfadaki `.proof-panel` görünümüyle aynı dili paylaşır. Hero zemini açık
olduğu için kart koyu olmalıdır.

**Duyarlılık:** Mevcut 900px ve 620px kademeleri `.hero-grid`'i tek sütuna
düşürüyor. `.hero-terminal` `min-width:0` ve yatay taşma koruması taşımalı;
`.code` zaten `white-space:pre-wrap` + `overflow-wrap:anywhere` kullanıyor.

**Copy butonu:** `site.js:48` `[data-copy]` öznitelikli tüm butonları dinler ve
`button.dataset.copy` değerini panoya yazar. Yeni terminal kartındaki butonun
`data-copy` değeri, `code-head` içinde görünen metinle aynı olmalıdır. Ek JS
gerekmez.

**Üretim akışı:** `build.py` ham HTML yazar, Prettier sonradan biçimlendirir.
Bu ikiliyi birlikte çalıştırmak zorunlu:

```
cd static-site && python3 build.py && npx prettier --write "**/*.html"
```

## Dürüstlük konvansiyonu

Sitenin mevcut kuralı korunur: henüz yayınlanmış ürün, paket veya fiyat
iddiası yapılmaz. JSON örnekleri gerçek TYPO3 JSON:API biçimindedir ancak
somut paket/endpoint/sürüm vaadi içermez.

## Kapsam dışı

- Yeni görsel dosyası üretimi
- `site.js` değişikliği
- Diğer sayfalar
