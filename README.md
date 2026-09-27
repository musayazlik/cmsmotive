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

- `app/[[...legacy]]/route.ts`: mevcut genel HTML sayfaları
- `app/auth/[mode]/route.ts` ve `public/auth-live.js`: mevcut hesap tasarımları üzerinden gerçek kayıt, giriş, doğrulama ve parola sıfırlama akışları
- `app/api/auth/[...all]/route.ts`: Better Auth API
- `app/panel/`: korumalı hesap paneli
- `prisma/schema.prisma`: PostgreSQL üzerindeki Better Auth tabloları
- `lib/plunk.ts`: doğrulama ve parola sıfırlama e-postaları
- `app/api/contact/route.ts`: iletişim formunu kaydeder ve Plunk ile bildirir

Statik sayfada değişiklik yapınca `static-site/build.py` ile HTML'leri yeniden üretin. `static-site/assets/` altında değiştirdiğiniz dosyaları `public/assets/` dizinine de kopyalayın. Eski blog yorumları yalnızca tarayıcıda tutulur; bunlar için henüz veritabanı işlemi tanımlanmadı.
