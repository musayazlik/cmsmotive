# CMSMotive — TYPO3 marka, lisans ve satışa hazırlık incelemesi

İnceleme tarihi: **24 Ekim 2026**. İncelenen uygulama: `http://localhost:3000`, mevcut çalışma ağacı. Kamuya açık canlı alan adı bu incelemede test edilmedi.

**Sonuç:** CMSMotive adı, incelenen ürün adları ve sitedeki açıklayıcı TYPO3 kullanımı bakımından açık bir marka ihlali saptanmadı. Ana sitedeki marka sahipliği ve bağımsızlık açıklaması olumlu. Bununla birlikte mevcut sürüm, ücretli satışa ve tam bir müşteri hesabı deneyimine hazır değil. Öncelikler: GPL ile hizmet paketlerini ayırmak, gerçek satıcı bilgilerini yayımlamak, veri işleme metinlerini uygulamayla eşleştirmek ve giriş ekranlarını tamamlamak.

Bu belge bir teknik ve içerik incelemesidir. Marka politikasındaki açık kurallar, uygulamada doğrulanmış bulgular ve öneriler ayrı belirtilmiştir. Alman/AB mevzuatı, Almanca varsayılan dil, `.de` iletişim adresi ve avro fiyatlaması nedeniyle araştırıldı; bu özellikler tek başına satıcının kuruluş ülkesini veya her kanunun uygulanacağını kanıtlamaz. Nihai koşullar satıcı ülkesi, müşterinin ülkesi ve B2B/B2C modeline göre kesinleştirilmelidir.

## 1. Kapsam ve kanıt sınırları

- Tarayıcıda ana sayfa, fiyatlandırma, Nordform, eklenti listesi ve Editorial Workflow ayrıntısı, Impressum, gizlilik, çerezler ve koşullar açıldı.
- Giriş, kayıt yönlendirmesi, şifre hatırlatma, tokensız şifre yenileme, e-posta doğrulama ve oturumsuz panel erişimi gözlendi.
- Yönetici panelinin menüleri, katalog/lisans düzenleyicileri, ayarları, rol kontrolleri, e-posta şablonu ve veri modelleri kaynak koddan incelendi. **Yönetici oturumu açılmadı; panel içi ekranlar tarayıcıda doğrulanmadı.**
- Hesap oluşturulmadı, e-posta gönderilmedi, ödeme yapılmadı, ayar veya içerik değiştirilmedi. Satılacak TYPO3 paketlerinin kaynak kodu, ZIP arşivi ve varlık lisansları incelenmedi.
- `pnpm test:admin-access`: **3 test geçti**. Bu testler özel panel yolları, gezinme ve giriş çerezi doğrulamasını kapsar; genel güvenlik sertifikası değildir.
- 13 oturumsuz HTTP kontrolü yapıldı. `/panel` ve `/panel/settings` girişe `307`; `/auth/sign-up` girişe `307`; hesap hedefi ve beş yönetici API uç noktası `401` döndü.
- HTTP kayıtları: [route-checks.json](<C:/Users/musay/.codex/visualizations/2026/10/24/01a16d55-3ff6-7d10-90d7-36e2f7cc0304/route-checks.json>).

## 2. TYPO3 kuralları: neye izin var?

Resmî marka politikası 19 Mayıs 2025 güncellemesini ve 21 Kasım 2025 belge taşınmasını belirtiyor. Olgusal, onay/ortaklık ima etmeyen açıklayıcı kullanım izinli. TYPO3 adının şirket, ürün, alan adı veya sosyal hesap/sayfa kimliğine katılması üyelikten bağımsız olarak yasaklanıyor. Üyelik rozeti aktif üyelik düzeyiyle eşleşmeli. Güncel politika ücretli reklamda kelime markasını Gold/Platinum üyelerle sınırlıyor. [TYPO3 Trademark Usage Policy](https://docs.typo3.org/m/typo3/guide-policy/main/en-us/Association/TrademarkUsagePolicy.html).

20 Mayıs 2025 tarihli resmî açıklama reklam ve basılı logo kullanımında TYPO3 Company Partners grubunu da anıyor. Politika ile duyurunun kapsam ifadeleri aynı değil. CMSMotive'in üyeliği, partnerliği veya özel izni doğrulanmadığı için reklam hakkı varsayılmamalı; bu kapsamda kampanya planlanıyorsa `trademark@typo3.org` üzerinden yazılı netleştirme alınmalı. Normal açıklayıcı site metni için üyelik gerektiği sonucu çıkarılmamalı. [Resmî marka kullanım açıklaması](https://news.typo3.com/article/typo3-trademark-usage-whats-allowed-and-whats-not-1).

Logo kullanılacaksa resmî dosya, renkler, oranlar ve boşluklar korunmalı. Logo kılavuzundaki yazı/simge birlikteliği kuralı, logo çizimine ilişkindir; paragraf içinde düz metin olarak TYPO3 yazmayı yasaklamaz. [Brand Guidelines](https://typo3.com/typo3-cms/the-brand/brand-guidelines).

Yazım **TYPO3**; URL ve teknik komutlardaki küçük harf kullanımı bununla karıştırılmamalı. Kılavuzun TYPO3 proje ürünleri için verdiği adlandırma örnekleri, üçüncü taraf ürün adına TYPO3 ekleme izni değildir. [How to Spell TYPO3](https://typo3.com/typo3-cms/the-brand/how-to-spell-typo3).

İncelenen politika her kullanımda `®` işareti veya her giriş ekranında belirli bir footer metni şart koşmuyor. Bu rapordaki kısa bağımsızlık notu önerisi, karışıklığı azaltan bir iyileştirmedir; eksikliği tek başına kesin marka ihlali sayılmamıştır.

## 3. Öncelik tablosu

| No | Öncelik | Bulgu | Durum |
|---|---|---|---|
| 1 | Satıştan önce | Single Site / Agency anlatımı GPL kod hakları ile hizmet kapsamını ayırmıyor | Doğrulandı; ihlal niteliği nihai paket/koşullara bağlı |
| 2 | Kamuya açılmadan önce | Impressum gerçek satıcı bilgileri yerine yer tutucular içeriyor | Doğrulandı |
| 3 | Veri toplamaya açılmadan önce | Gizlilik/çerez açıklamaları taslak ve mevcut veri akışları için eksik | Doğrulandı |
| 4 | Öncelikli | Giriş ailesinde doğrudan Impressum bağlantısı yok; bağımsızlık notu da taşınmıyor | Doğrulandı; marka notu öneri |
| 5 | Kayıt açılmadan önce | Kullanım koşulu kabulü yalnız HTML doğrulamasında; kabul sürümü kaydı yok | Kaynak kodda doğrulandı |
| 6 | Satıştan önce | Müşteri hesabı vaadi var; sipariş/indirme/hizmet hakkı alanı yok | Kaynak ve yönlendirmelerde doğrulandı |
| 7 | Pazarlama gönderiminden önce | Newsletter kaydı için doğrulama/geri çekme ve ispat akışı eksik | İncelenen uygulama içinde doğrulandı |
| 8 | Öncelikli | Konsept üründe test verisi izlenimi veren onaylı yorum ve 5.0 puan var | Yerel sürümde doğrulandı |
| 9 | Öncelikli | Panelde marka/lisans/yayın öncesi kontrol alanları yok | Kaynak kodda doğrulandı; ekleme önerisi |
| 10 | İyileştirme | Giriş İngilizce, hukuk bağlantıları varsayılan Almancaya gidiyor | Doğrulandı |
| 11 | Operasyonel | Yönetici yedeği kişisel veriler ve ayarları içeriyor | Kaynak kodda doğrulandı; yetkisiz sızıntı saptanmadı |
| 12 | Kampanya öncesi | Üyelik/partnerlik ve ücretli reklam izni belirsiz | Dış doğrulama gerekli |

## 4. Bulgular ve somut düzeltmeler

### 1 — GPL kod lisansı ile ticari hizmet paketleri ayrılmalı

`/en/pricing` üzerinde “For one client site”, “One production site”, “Proposed multi-project use” ifadeleri var. Nordform ayrıntısında “Select proposed licence” seçimi bulunuyor. Henüz taslak fiyat ve koşul oldukları belirtiliyor; dolayısıyla uygulanmış bir kod kısıtlaması kanıtlanmış değil. Ancak bu dil, ücretin GPL kodunun tek sitede kullanılabilmesi için alındığı izlenimini yaratıyor.

TYPO3, CMS ile kurulu eklentileri birleşik program olarak değerlendiriyor; resmî açıklamasına göre eklentiler GPL-2.0-or-later kapsamındadır, satılabilir ve alıcının lisans kapsamındaki değiştirme/yeniden dağıtım hakları korunur. Bu değerlendirme TYPO3 paketleri içindir; satış sitesinin Next.js kodunun otomatik olarak GPL olması gerektiği anlamına gelmez. [TYPO3 Open Source Licenses](https://typo3.com/typo3-cms/what-is-typo3/open-source/licenses).

**Önerilen model:** Kod lisansını ayrı gösterin; ücretli planları güncelleme kanalı, destek süresi, desteklenen kurulum sayısı, hizmet seviyesi ve ilk teslimat kapsamı üzerinden tanımlayın. GPL kodunun kullanımını ek domain ücreti, yeniden dağıtım yasağı veya abonelik bitiminde çalışmayı durdurma şartıyla sınırlamayın. Ücretli indirme dağıtımı mümkündür; herkese ücretsiz indirme açma zorunluluğu sonucu çıkarılmamalıdır. [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html).

Tema içindeki Fluid/PHP/TypoScript, bağımsız JS/CSS, fontlar, fotoğraflar ve diğer varlıkların lisans haritası gerçek paket üzerinden çıkarılmalı. Her varlık için tek tip lisans varsaymayın. Paketle birlikte uygun lisans metni, telif bildirimleri, kaynaklar ve üçüncü taraf bildirimleri teslim edilmeli.

Kod: [fiyat metni](<C:/Users/musay/Projects/cmsmotive/static-site/build.py:225>), [ürün kutusu](<C:/Users/musay/Projects/cmsmotive/app/[locale]/(product)/_components/product-detail.tsx:172>), [lisans editörü](<C:/Users/musay/Projects/cmsmotive/app/panel/_components/catalog-detail-fields.tsx:122>), [lisans veri tipi](<C:/Users/musay/Projects/cmsmotive/lib/catalog-guard.ts:57>).

### 2 — Impressum tamamlanmamış

`/en/imprint`, “Registered legal name”, adres ve sicil/vergi alanlarını yer tutucu olarak gösteriyor. Sadece e-posta ve bağımsızlık açıklaması yeterli satıcı kimliği sağlamıyor. Ticari tanıtım ve veri toplama nedeniyle bu işi yalnız ödeme açılışına bırakmayın.

Gerçek unvan, tebligata elverişli adres, tüzel kişiyse temsilci ve ilgili kayıt bilgileri, varsa ilgili vergi kimliği ve iletişim bilgileri tamamlanmalı. Almanya bakımından DDG §5, sağlayıcı bilgilerinin sürekli ve doğrudan erişilebilir olmasını düzenler. [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html).

Kod: [hukuk sayfası kaynağı](<C:/Users/musay/Projects/cmsmotive/static-site/build.py:300>). Aynı düzeltme üretilmiş HTML ve DE/EN/TR içeriklerine yansıtılmalı.

### 3 — Gizlilik ve çerez metni gerçek uygulamayı anlatmalı

`/privacy` hâlâ veri sorumlusunu, barındırıcıyı, saklama süresini ve hukuki dayanağı sonradan doldurulacak bilgiler olarak bırakıyor. `/cookies` ise blog yorumlarını tarayıcıda tutulan bir önizleme gibi anlatıyor. Oysa yorum API'si veritabanına yazıyor ve ardından AI incelemesini başlatıyor.

İncelenen veri akışları:

| İşlem | Kodda görülen veri/sağlayıcı | Metinde yapılacak iş |
|---|---|---|
| Hesap ve oturum | Ad, e-posta, kimlik doğrulama kayıtları; oturum şemasında IP/user-agent alanları | Amaç, kapsam, saklama ve hak başvurusu yolu |
| E-posta | Plunk üzerinden doğrulama, şifre sıfırlama ve bildirimler | İşleyen, alıcılar, gerçek bölge ve aktarım düzeni |
| Blog yorumları | Veritabanı; yapılandırılmışsa yorum gövdesinin OpenRouter/model sağlayıcısına gönderilmesi | AI moderasyonu ve olası kişisel veri aktarımı |
| Ürün yorumları | Ad, özel e-posta, puan, yorum; gönderimde Google reCAPTCHA | Moderasyon, yayınlama ve üçüncü taraf doğrulama açıklaması |
| Newsletter | Ad, soyad, e-posta, kaynak | Pazarlama amacı, dayanak, doğrulama ve ayrılma |
| Medya/panel | UploadThing; yapılandırmaya bağlı Telegram ve AI araçları | Gerçek kullanım durumuna göre işleyen/envanter |
| Sayfa ölçümü | Gün ve sayfa adına göre sunucu sayacı | Kişi izleme ile anonim toplam sayacı ayıran doğru açıklama |

AI yorum isteğine ad/e-posta ayrı alan olarak eklenmiyor; bu olumlu. Ancak serbest yorum metninin kendisi kişisel veri içerebilir. Sağlayıcıların gerçek sözleşmeleri ve veri bölgeleri bu araştırmada doğrulanmadı.

GDPR uygulanıyorsa toplama anında kimlik, amaç, hukuki dayanak, alıcı/aktarım, saklama ve hak bilgileri gerçek işlemle eşleşmeli. Gizlilik bildirimini okumayı, her veri işlemi için zorunlu rıza vermekle eşitlemeyin. [GDPR, özellikle md. 6 ve 13](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1526560528451&uri=CELEX%3A32016R0679).

Giriş sayfasında Google Fonts ve `fonts.gstatic.com` istekleri tarayıcı kaynak kayıtlarında görüldü. Fontları kendi sunucunuzdan sunmak bu dış aktarımı azaltır. Sadece zorunlu oturum saklaması bulunduğu için otomatik olarak banner gerektiği veya banner hiç gerekmeyeceği sonucuna varılmamalı; reCAPTCHA ve diğer kaynakların fiilî davranışı değerlendirilmelidir. [TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html).

Kod: [gizlilik/çerez metinleri](<C:/Users/musay/Projects/cmsmotive/static-site/build.py:301>), [yorum kaydı ve AI çağrısı](<C:/Users/musay/Projects/cmsmotive/app/api/blog-comments/route.ts:44>), [AI'ye gönderilen içerik](<C:/Users/musay/Projects/cmsmotive/lib/comment-ai.ts:19>), [oturum modeli](<C:/Users/musay/Projects/cmsmotive/prisma/schema.prisma:27>), [sayfa sayacı](<C:/Users/musay/Projects/cmsmotive/lib/analytics.ts:15>).

### 4 — Login ailesinde satıcıya ve marka bağlamına erişim tamamlanmalı

Giriş, şifre hatırlatma, yenileme ve doğrulama aynı bileşeni kullanıyor. CMSMotive logosu ve “Made for TYPO3” açıklayıcı ifadesi var. Resmî TYPO3 hesabı veya TYPO3 SSO taklidi saptanmadı.

Footer yalnız `Privacy`, `Terms`, `Help` içeriyor. Doğrudan `Impressum` ekleyin. Ek olarak kısa bağımsızlık açıklaması bütün giriş ailesinde kullanılabilir. Aynı metni özel yönetici girişinde de gösterin. Bu açıklamanın eksikliği tek başına marka ihlali değildir; mevcut marka çerçevesinin tutarlı taşınması önerisidir.

`/auth/verify-email` e-posta bilgisi olmadan da gönderilmiş gibi konuşuyor; kayıt kapalıyken “Create a new account” bağlantısı girişe geri dönüyor. Bu durumlar için bağlama uygun açıklama gösterin. E-posta gönderildiğini sadece akış bunu doğruladığında söyleyin.

Kod: [ortak giriş ekranı](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-screen.tsx:67>), [kayıt ve geçiş kontrolü](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-page.tsx:39>), [doğrulama metni](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-form.tsx:141>).

### 5 — Kayıt kabulü kanıtlanabilir değil

Kayıt ekranında `required` işaretli koşul kutusu var; fakat kayıt POST verisine kabul bilgisi ve belge sürümü eklenmiyor. Kullanıcı şemasında kabul zamanı/sürümü alanı yok. API'de kayıt kapalı ayarı ayrıca korunuyor; bu olumlu.

Kayıt açıldığında kabul edilen kullanım koşulları sürümü, kabul zamanı ve gerekli kanıt kaydı sunucuda doğrulanmalı. Pazarlama izni ayrı ve isteğe bağlı olmalı. Gizlilik bildirimini sunmak ile rıza gerektiren işlemler için izin istemek ayrı tasarlanmalı. Her uygulamanın belirli bir isimde veritabanı alanı tutmasının kanunen zorunlu olduğu iddia edilmiyor; burada mevcut kabulün ispatı ve tutarlılığı eksik.

Kod: [POST alanları](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-form.tsx:86>), [koşul kutusu](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-form.tsx:166>), [kayıt API kontrolü](<C:/Users/musay/Projects/cmsmotive/app/api/auth/[...all]/route.ts:11>), [kullanıcı modeli](<C:/Users/musay/Projects/cmsmotive/prisma/schema.prisma:10>).

### 6 — Yönetici paneli ile müşteri hesabı ayrılmalı

Login metni “CMSMotive workspace” vaat ediyor; kayıt metni tema, eklenti ve kaynaklardan söz ediyor. Gerçekte panel yalnız admin/superadmin için; normal kullanıcı girişten sonra ana sayfaya gönderiliyor. İncelenen şemada sipariş, satın alınmış ürün, indirme hakkı, fatura veya destek/güncelleme yetkisi modeli yok.

Satışa geçerken müşteri alanı oluşturulmalı: satın almalar, paket/sürüm indirme, faturalar, destek/güncelleme süresi, parola ve oturum yönetimi, veri talebi yolu. Yönetici paneli buna açılmamalı. Hesap kapatma talebi için işleyen bir süreç yeterli olabilir; her durumda otomatik bir “hesabı sil” düğmesinin zorunlu olduğu söylenemez.

Mevcut olumlu kontroller: sayfa seviyesinde rol kontrolü, yönetici API kontrolü, zorunlu e-posta doğrulaması, parola yenilemede oturum iptali ve yapılandırılmış hız sınırı. Özel panel yolu da destekleniyor. MFA görülmedi; yönetici hesapları için önerilir, marka şartı değildir. Bellekteki hız sınırı çoklu sunucuya geçişte ortak depoya taşınmalı.

Kod: [panel koruması](<C:/Users/musay/Projects/cmsmotive/lib/panel-auth.ts:14>), [hesap hedefi](<C:/Users/musay/Projects/cmsmotive/app/api/auth-target/route.ts:15>), [auth ayarları](<C:/Users/musay/Projects/cmsmotive/lib/auth.ts:26>), [panel kabuğu](<C:/Users/musay/Projects/cmsmotive/app/panel/_components/panel-shell.tsx:24>).

### 7 — Newsletter pazarlama akışı tamamlanmalı

API doğrudan abone kaydediyor; şemada doğrulama, izin metni sürümü, geri çekilme veya unsubscribe token alanları yok. İncelenen uygulamada ayrılma uç noktası da bulunmadı. Üçüncü taraf bir gönderim sisteminin bunları ayrıca uyguladığı doğrulanmadı.

Pazarlama listesi ile “site yeniden açıldığında haber ver” listesi ayrılmalı. Double opt-in, izin metni/zamanı kaydı ve kolay ayrılma akışı eklenmeli; doğrulanmamış adreslere kampanya gönderilmemeli. Double opt-in'i kanunda birebir adı geçen evrensel bir zorunluluk olarak değil, adres sahipliği ve izin ispatı için öneriyorum. Alman hukukunda pazarlama e-postasında önceden izin ve belirli istisnalar/ayrılma imkânı UWG §7 kapsamında değerlendirilir. [UWG §7](https://www.gesetze-im-internet.de/uwg_2004/__7.html).

Kod: [doğrudan abone kaydı](<C:/Users/musay/Projects/cmsmotive/app/api/newsletter/route.ts:41>), [abone modeli](<C:/Users/musay/Projects/cmsmotive/prisma/schema.prisma:376>).

### 8 — Test yorumu ve yorum doğrulaması

Nordform henüz konseptken yerel sayfada 1 yorum üzerinden **5.0** puan görünüyor. Yorum içeriği test verisi izlenimi veren anlamsız karakterlerden oluşuyor. Bu verinin gerçek müşteri deneyimi olmadığı kesinleştirilmedi; ancak yayın öncesi temizlenmesi/teyidi gerekiyor. Puan aynı zamanda JSON-LD'ye ekleniyor; sadece görünür yorumu saklamak yeterli olmayabilir.

“Every review is checked” yalnız moderasyonu anlatıyor. Satın alma veya gerçek kullanım doğrulaması incelenen şemada yok. Gerçekte kullanılan yöntem açıkça yazılmalı; beta değerlendirmeleri müşteri satın alma yorumundan ayırt edilmeli. Uygulanıyorsa UWG §5b(3), yorumların gerçek kullanıcı/alıcı kaynaklı olduğunun **kontrol edilip edilmediği ve nasıl kontrol edildiği** bilgisini ister; bütün yorumların zorunlu olarak satın alma doğrulamalı olmasıyla aynı şey değildir. [UWG §5b](https://www.gesetze-im-internet.de/uwg_2004/__5b.html).

Kod: [yorum açıklaması](<C:/Users/musay/Projects/cmsmotive/app/[locale]/(product)/_components/product-detail.tsx:66>), [puanlı yapılandırılmış veri](<C:/Users/musay/Projects/cmsmotive/app/[locale]/(product)/_components/product-route.tsx:53>), [yorum modeli](<C:/Users/musay/Projects/cmsmotive/prisma/schema.prisma:96>).

### 9 — Panelde yayın öncesi uyumluluk bilgileri eksik

Katalog editörü ürün adı, durum, fiyat ve uyumluluk metni yönetiyor. Lisans satırı yalnız `name` ve `price` içeriyor. Ad doğrulaması uzunluk, slug doğrulaması biçim kontrolü yapıyor; TYPO3 marka bağlamını denetlemiyor. Bu mevcut ürünlerde ihlal kanıtı değil, gelecekte yanlış yayın yapılmasını önleme fırsatıdır.

Panelde önerilen alanlar: kod lisansı/SPDX, üçüncü taraf bildirim bağlantısı, hizmet planı kapsamı, güncelleme ve destek süresi, doğrulanmış sürüm matrisi, teslimat paketi, ilgili satış koşulu sürümü ve marka/rozet kullanım dayanağı. `published` durumuna geçişte bu bilgiler için kontrol olmalı. Mevcut kod bu duruma geçince `InStock` teklif verisi üretebiliyor; doğrulanmış teslimat ve satış koşulları olmadan açılmamalı.

Özel bir “Legal” ayar alanı öneriyorum: satıcı kimliği, metin sürümleri, marka notu, izin/üyelik belgeleri ve gerçek servis envanteri. Serbest metindeki bütün TYPO3 kelimelerini engelleyen bir doğrulama yazılmamalı; açıklayıcı kullanım izinli.

AI yazım talimatına doğru TYPO3 yazımı ve kanıtsız resmî onay/sertifika iddiasından kaçınma eklenebilir. Mevcut prompt bir marka iddiası üretildiğini kanıtlamıyor; bu bir önleyici öneridir.

Kod: [temel doğrulama](<C:/Users/musay/Projects/cmsmotive/lib/catalog-guard.ts:285>), [ayar sekmeleri](<C:/Users/musay/Projects/cmsmotive/app/panel/settings/_tabs.ts:5>), [teklif üretimi](<C:/Users/musay/Projects/cmsmotive/app/[locale]/(product)/_components/product-route.tsx:34>), [AI prompt](<C:/Users/musay/Projects/cmsmotive/lib/ai-writer-prompts.ts:15>).

### 10 — Dil ve e-posta tutarlılığı

Genel site DE/EN/TR destekliyor; giriş ailesi İngilizce. `/privacy` ve `/terms` bağlantıları dil taşımadığı için varsayılan Almanca açılıyor. Dil seçimi taşınmalı veya bağlantı dili açıkça belirtilmeli. “Nordform — Theme for TYPO3 CMS — CMSMotive” gibi başlıklar kendi ürün markası ile uyumluluk ifadesini daha belirgin ayırır; mevcut “Nordform TYPO3 theme” başlığı tek başına kesin ihlal olarak değerlendirilmemiştir.

Şifre sıfırlama/doğrulama e-postası CMSMotive adını doğru kullanıyor. Şablonda satıcı künyesi/hukuk bağlantıları yok. Gerçek satıcı kimliği ve ticari yazışma yükümlülüklerine göre kısa footer eklenmeli; TYPO3 kelimesi içermeyen her işlem e-postasına marka bildirimi koymak şart değildir.

Kod: [hukuk bağlantıları](<C:/Users/musay/Projects/cmsmotive/app/auth/_components/auth-screen.tsx:70>), [e-posta şablonu](<C:/Users/musay/Projects/cmsmotive/lib/plunk.ts:58>).

### 11 — Yedek ve kişisel veri yönetimi

Yedek; kullanıcı e-postası eşlemesini, mesajları, yorumları, aboneleri ve panel ayarlarını içeriyor. Kimlik doğrulama parola/oturum tabloları bu formata alınmıyor; ancak bu, yedeğin kişisel veri veya hassas ayar içermediği anlamına gelmez. Oturumsuz `/api/admin/backup` isteği `401` döndü; yetkisiz dışa aktarım saptanmadı.

Yedek saklama süresi, erişim yetkisi, güvenli depolama ve silinen kayıtların geri yüklemeyle yeniden ortaya çıkmasını önleme süreci tanımlanmalı. Veri sahibi talepleri için bu kopyalar da envantere alınmalı. Bu, genel veri yönetimi önerisidir; rapor bir yedek sızıntısı iddia etmez.

Kod: [yedek içeriği](<C:/Users/musay/Projects/cmsmotive/lib/backup.ts:7>), [yedek API koruması](<C:/Users/musay/Projects/cmsmotive/app/api/admin/backup/route.ts:15>).

## 5. Satış açılışı için eksik sözleşme/akış

Mevcut `/terms`, sitede sipariş, ödeme ve paket teslimi yapılmadığını söylüyor. İncelenen ürün çağrıları da iletişim/erken erişime yönleniyor. Dolayısıyla bugün yapılmış bir hatalı ödeme akışı saptanmadı; aşağıdakiler satış açılışı gereksinimleridir:

- B2B/B2C hedefi ve gerçek satıcı kimliği.
- Kesin ürün içeriği, kod lisansı, ayrıca hizmet kapsamı, uyumluluk ve teslimat yöntemi.
- Vergi dâhil/hariç gösterimin hedef kitleye uygun açıklaması, toplam bedel, para birimi ve ödeme sağlayıcısı.
- Güncelleme/destek süresi, yenileme varsa dönemi ve sonlandırma; sürenin bitiminde hangi hizmetin bittiği.
- Cayma bilgisi, gönüllü iade politikası ve ayıp/uygunluk haklarının birbirinden ayrılması.
- Tüketiciye dijital içeriği cayma süresi dolmadan teslim edecekseniz gerekli açık onay, hakkın kaybının kabulü ve kalıcı ortamda teyit akışı. “Dijital üründe iade yok” tek satırı bunun yerine geçmez. [BGB §356](https://www.gesetze-im-internet.de/bgb/__356.html).
- Tüketici siparişi ödeme yükümlülüğünü açıkça ifade eden düğme ve son sipariş özeti. [BGB §312j](https://www.gesetze-im-internet.de/bgb/__312j.html).

## 6. Kullanılabilecek kısa metinler

Bu örnekler marka bağlamını netleştirmek içindir; tamamlanmış satış sözleşmesi değildir. “Bağımsızlık” kısmı CMSMotive'in gerçek statüsüne göre teyit edilmelidir.

**İngilizce marka notu**

> TYPO3 is a registered trademark of the TYPO3 Association. CMSMotive is an independent provider of themes and extensions for TYPO3 CMS and is not affiliated with or endorsed by the TYPO3 Association.

**Almanca marka notu**

> TYPO3 ist eine eingetragene Marke der TYPO3 Association. CMSMotive ist ein unabhängiger Anbieter von Themes und Erweiterungen für TYPO3 CMS und ist weder mit der TYPO3 Association verbunden noch von ihr autorisiert oder unterstützt.

**Türkçe marka notu**

> TYPO3, TYPO3 Association'ın tescilli markasıdır. CMSMotive, TYPO3 CMS için tema ve eklentiler sunan bağımsız bir sağlayıcıdır; TYPO3 Association ile bağlantılı değildir ve onun tarafından onaylanmamıştır.

**Hizmet planı açıklaması — yalnız gerçek paket lisansı doğrulandıktan sonra**

> The TYPO3 extension code is provided under GPL-2.0-or-later. Paid plans define the scope and duration of update access and support services. They do not restrict your rights under the GPL. Any separately licensed assets are identified in the package notices.

“Single Site” korunacaksa örneğin **Support & Updates — 1 Installation** gibi hizmete bağlı bir ad ve net kapsam kullanılabilir. Bu ticari model önerisidir; henüz satılan paketin veya varlıkların lisansına ilişkin doğrulama değildir.

## 7. Değiştirilmesi gerekmeyen olumlu noktalar

- CMSMotive ve Nordform/Foundation/Campus/Editorial Workflow gibi adlar, incelenen haliyle TYPO3'ü kendi ürün markasına katmıyor.
- Kendi mavi CMSMotive logosu kullanılıyor; incelenen ana/giriş ekranları resmî TYPO3 görsel kimliğini taklit etmiyor.
- Ana site footer'ında, Impressum'da ve SSS'de marka sahipliği/bağımsızlık açıklaması mevcut.
- Yapılandırılmış ürün verisinde marka **CMSMotive**, kategori ise TYPO3 tema/eklenti olarak ayrılmış.
- Konsept ürünler için `Offer` üretilmemesi ve fiyatların konsept olarak belirtilmesi olumlu.
- Resmî ortaklık/sertifika iddiası incelenen sabit metinlerde görülmedi; bunu gelecekte de kanıtsız eklemeyin.

## 8. Görsel kanıtlar ve ekran adımları

| Adım | Ekran | Değerlendirme |
|---|---|---|
| 1 | Ana sayfa | Bağımsız marka ve konsept statüsü belirgin; marka yaklaşımı olumlu |
| 2 | Fiyatlandırma | Konsept etiketi olumlu; kod/hizmet kapsamı ayrımı eksik |
| 3 | Nordform ve yorumlar | Ürün adı uygun; test izlenimli yorum ve puan düzeltilmeli |
| 4 | Impressum/gizlilik/çerez/koşullar | Sayfalar var; içerik taslak ve kısmen güncelliğini yitirmiş |
| 5 | Giriş | Kendi marka kimliği olumlu; hukuk erişimi ve dil eksik |
| 6 | Kayıt | Şu anda kapalı, girişe yönleniyor; kabul akışı yalnız kaynak koddan değerlendirildi |
| 7 | Şifre hatırlatma/yenileme | Ekranlar erişilebilir; gerçek e-posta ve token akışı denenmedi |
| 8 | E-posta doğrulama | Bağlamsız “gönderildi” metni ve kapalı kayda dönüş bağlantısı iyileştirilmeli |
| 9 | Yönetici paneli | Oturumsuz erişim engelli; iç ekranlar kaynak koddan incelendi |

![Giriş ekranı — footer'da Privacy, Terms ve Help](<C:/Users/musay/.codex/visualizations/2026/10/24/01a16d55-3ff6-7d10-90d7-36e2f7cc0304/06-sign-in-full.png>)

![Fiyatlandırma — lisans kapsamı anlatımı](<C:/Users/musay/.codex/visualizations/2026/10/24/01a16d55-3ff6-7d10-90d7-36e2f7cc0304/13-pricing-full.png>)

![Impressum — tamamlanmamış satıcı alanları](<C:/Users/musay/.codex/visualizations/2026/10/24/01a16d55-3ff6-7d10-90d7-36e2f7cc0304/10-imprint.png>)

![Nordform yorumları — yerel test verisi izlenimli kayıt](<C:/Users/musay/.codex/visualizations/2026/10/24/01a16d55-3ff6-7d10-90d7-36e2f7cc0304/12-reviews-actual.png>)

## 9. Uygulama sırası ve açık kalan kararlar

1. Gerçek satıcı ülkesi/unvanı ve B2B/B2C kapsamını kesinleştirin; Impressum ve gizlilik metnini tamamlayın.
2. Mevcut veri akışlarını ve newsletter'ı açıklayın; font/reCAPTCHA/AI aktarımı kararlarını uygulayın.
3. GPL kod lisansı ile ücretli destek/güncelleme planlarını ayırın; paket lisans envanterini çıkarın.
4. Giriş ailesine Impressum, dil tutarlılığı ve kısa marka notunu ekleyin; kayıt kabulünü sunucuda kaydedin.
5. Test yorumları ve içerikleri temizleyin; yorum doğrulama yöntemini açıklayın.
6. Panelde yayın kontrolü ve müşteri satın alma/indirme alanını kurun; ardından satış koşulları ve ödeme akışını açın.
7. TYPO3 adını ücretli reklamda kullanmadan önce üyelik/özel izin kapsamını teyit edin.

Kesinleştirilemeyenler: gerçek şirket ve vergi bilgileri; aktif TYPO3 üyelik/partnerlik/özel izin durumu; satılacak paketlerin lisansları ve görsel hakları; üretim sağlayıcıları/veri bölgeleri; gerçek müşteri hesabı ve ödeme sağlayıcısı; yönetici oturumu içindeki çalışma davranışı. Bunlar mevcut kaynaklardan tahmin edilmedi.

Bu çalışma kapsamında uygulama koduna değişiklik yapılmadı; yalnız bu araştırma raporu eklendi.
