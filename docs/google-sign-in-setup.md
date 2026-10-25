# Google ile giriş kurulumu

Uygulamada e-posta ile kayıt/giriş, Google OAuth ve giriş yapan kullanıcı için header hesap menüsü hazırlandı. Google anahtarları olmadığı için Google düğmesi henüz devreye alınmadı.

1. [Google Cloud Console](https://console.cloud.google.com/) içinde bir proje oluşturun veya mevcut projeyi seçin.
2. Google Auth Platform → Branding bölümünde uygulama adı, destek e-postası ve geliştirici iletişimini doldurun. Canlı yayında gerçek ana sayfa, gizlilik ve kullanım koşulları URL'lerini ekleyin.
3. Audience bölümünde halka açık müşteri üyeliği için **External** seçin. Uygulama Testing durumundayken giriş yapacak Google hesaplarını Test users listesine ekleyin.
4. Data Access bölümünde yalnız temel giriş bilgilerini (`openid`, `email`, `profile`) kullanın. Drive, Gmail veya ek izinler gerekmiyor.
5. Clients → Create client → **Web application** oluşturun.
6. Authorized JavaScript origins alanına `http://localhost:3000` ekleyin. Canlıda ayrıca gerçek HTTPS site origin'ini ekleyin.
7. Authorized redirect URIs alanına **tam olarak** `http://localhost:3000/api/auth/callback/google` ekleyin. Canlıda karşılığını `https://GERCEK-ALAN-ADINIZ/api/auth/callback/google` olarak ekleyin. Şema, alan adı, port ve yol eşleşmeli.
8. Projenin `.env` veya `.env.local` dosyasına ekleyin; anahtarları sohbete veya Git'e koymayın:

   ```dotenv
   GOOGLE_CLIENT_ID="Google Web client ID"
   GOOGLE_CLIENT_SECRET="Google Web client secret"
   BETTER_AUTH_URL="http://localhost:3000"
   ```

9. Geliştirme sunucusunu yeniden başlatın. `/auth/sign-in?lang=tr` ve `/auth/sign-up?lang=tr` üzerinden koşulları kabul edip **Google ile devam et** düğmesini deneyin. İlk girişte kullanıcı hesabı oluşturulur; sonraki girişlerde aynı hesaba dönülür.

## Hesap davranışı

- Google'dan yalnız temel profil ve doğrulanmış e-posta alınır. Kullanıcıya yönetici rolü atanmaz.
- Koşul kabulü OAuth yönlendirmesinden önce doğrulanır ve Better Auth'ın sunucuya ait OAuth state alanında taşınır. Yeni hesap kaydında güncel koşul/gizlilik sürümleri ve zaman damgası kaydedilir.
- E-posta/parola hesabıyla aynı e-postaya sahip Google hesabı kendiliğinden birleştirilmez. Mevcut parola hesabı için e-posta/parola girişini kullanın. Hesap birleştirme ayrı bir özellik olacaktır.
- Google anahtarları olmadan düğme pasiftir; e-posta ile üyelik akışı kullanılabilir.
- Genel → Accounts ayarındaki kayıt seçeneği açıldı. Yerel geliştirmede test kaydı yapılabilir. Üretimde sağlayıcı, gizlilik ve hesap koşullarının incelemesi tamamlanmadan yeni hesap kaydı açılmaz; bu yerel test istisnası üretimde çalışmaz.
- E-posta kaydında doğrulama iletisi Plunk üzerinden gönderilir. Plunk anahtarı ve doğrulanmış gönderen adresi çalışır durumda olmalıdır.
- Giriş sonrası header'da avatar, ürünler, abonelik/fatura, hesap ayarları ve çıkış menüsü görünür. Yönetici bağlantısı yalnız yetkili oturumda eklenir. Statik ve React sayfaları aynı menüyü kullanır.

Canlıya geçerken Google yayın/test kullanıcı ayarlarını, doğrulanmış alan adlarını, gizlilik sağlayıcı listesini ve gerçek bir Google hesabıyla giriş/çıkışı kontrol edin. Anahtarlar olmadan Google tarafındaki tam giriş akışı doğrulanamaz.

Kaynaklar: [Better Auth Google sağlayıcısı](https://www.better-auth.com/docs/authentication/google), [OAuth ve sunucuya ait state verisi](https://better-auth.com/docs/concepts/oauth), [Google web sunucusu OAuth rehberi](https://developers.google.com/identity/protocols/oauth2/web-server).
