# Discord Clone

<p align="right">
  Dil: <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a>
</p>

Discord'dan esinlenen, tam kapsamlı ve gerçek zamanlı bir topluluk sohbet uygulamasıdır. Güvenli e-posta doğrulaması, kalıcı sunucu ve konuşmalar, ayrıntılı rol sistemi, moderasyon, sesli/görüntülü iletişim, topluluk araçları ve Electron masaüstü istemcisi içerir.

> Bu bağımsız eğitim projesinin Discord Inc. ile bağlantısı yoktur ve Discord Inc. tarafından desteklenmez. Discord, Discord Inc.'in ticari markasıdır.

## Öne çıkan özellikler

- Kayıt ve giriş sırasında e-posta kodu doğrulaması, şifre sıfırlama, e-posta değiştirme onayı, JWT oturumları ve bcrypt şifreleme
- Gerçek zamanlı sunucu kanalları, özel mesajlar, grup mesajları, yazıyor göstergesi, çevrimiçi durumu, yanıt, tepki, sabitleme, arama, dosya, GIF, sesli mesaj, düzenleme geçmişi, taslak ve okunmamış mesaj takibi
- Mikrofon/sağırlaştırma kontrolleri, kamera, ekran paylaşımı, bas-konuş, giriş/çıkış cihaz ayarları, konuşan kişi çerçevesi, yeniden bağlanma, sahne kanalları ve ses tahtası
- Sunucu sahipliği, sıralanabilir roller, ayrıntılı yetkiler, kanal bazlı yetki geçersiz kılma, takma ad, sunucu profili, atma, yasaklama, zaman aşımı, susturma/sağırlaştırma/bağlantı kesme ve denetim kayıtları
- Kategori; metin, ses, sahne, duyuru ve forum kanalları; başlıklar, etiketler, anketler, yavaş mod, NSFW onayı, geçici ses kanalları ve geri alınabilir kanal çöp kutusu
- Davet bağlantıları, üyelik taraması, onboarding soruları, sunucu keşfi, sunucu şablonları, planlı etkinlikler ve katılım yanıtları
- Spam, yasaklı kelime, bağlantı, davet, aşırı büyük harf ve etiket için AutoMod; kullanıcı/mesaj raporlama ve engelleme listesi
- Webhook, özel slash komutları ve kalıcı bot yanıtları, özel emoji/sticker, duyuru takibi, bildirim tercihleri, istatistik, dışa aktarma ve yedekleme
- SQLite kalıcılığı, ilk çalıştırmada JSON aktarımı ve Electron'a uygun uygulama veri klasörü
- Açık, koyu ve gece temaları; biyografi, banner, özel durum ve görünürlük tercihleri
- Web istemcisi ile Windows, macOS ve Linux için Electron paketi

## Kullanılan teknolojiler

- Frontend: React 18, Vite 8, Tailwind CSS, Socket.IO Client, PeerJS
- Backend: Node.js, Express, Socket.IO, PeerJS Server, JWT, bcrypt, Nodemailer
- Veri: `better-sqlite3` ile SQLite
- Masaüstü: Electron

## Gereksinimler

- Node.js 20.19 veya üzeri (Node.js 22 LTS önerilir)
- npm
- Zorunlu e-posta doğrulaması için bir SMTP hesabı
- Ses özellikleri için mikrofon/kamera izni verebilen tarayıcı veya işletim sistemi

## Geliştirme kurulumu

```bash
git clone https://github.com/tahosg2m3/discord-clone.git
cd discord-clone
npm install
```

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayın ve kendi gizli bilgilerinizi yazın:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
JWT_SECRET=uzun-ve-rastgele-bir-deger-yazin

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=epostaniz@example.com
SMTP_PASS=uygulama-sifreniz
MAIL_FROM="Discord Clone <epostaniz@example.com>"
```

Gmail kullanıyorsanız normal hesap şifresi yerine Uygulama Şifresi kullanın. `backend/.env`, `runtime.env`, veritabanları, yüklenen dosyalar ve oluşturulan gizli anahtarları GitHub'a göndermeyin.

Tüm geliştirme servislerini başlatın:

```bash
npm run dev
```

Frontend `http://localhost:5173`, API/Socket.IO sunucusu `http://localhost:3001`, uygulamayla gelen PeerJS sinyal sunucusu ise varsayılan olarak `9000` portunda çalışır.

Servisleri ayrı ayrı çalıştırmak için:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:electron
```

## İsteğe bağlı frontend ortam ayarları

Servisler localhost dışında çalışacaksa `frontend/.env.local` oluşturun:

```env
VITE_API_URL=https://ornek.com/api
VITE_API_ORIGIN=https://ornek.com
VITE_SOCKET_URL=https://ornek.com
VITE_PEER_HOST=peer.ornek.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=true
VITE_TENOR_API_KEY=tenor-api-anahtariniz
```

## Derleme

```bash
# Web üretim paketi
npm run build:frontend

# Kullanılan işletim sistemi için Electron kurulum/paket dosyası
npm run build:electron

# İkisi birlikte
npm run build
```

Electron çıktıları `release/` klasörüne yazılır.

Paketlenmiş masaüstü kurulumunda, uygulama veri klasöründeki `runtime.env.example` dosyasını `runtime.env` adıyla kopyalayıp gerçek SMTP bilgilerini girin. Uygulama SQLite verisini, yüklemeleri ve otomatik ürettiği JWT anahtarını işletim sisteminin uygulama veri klasöründe saklar.

## Güvenlik

- Yayın sırasında npm bağımlılık listelerinde bilinen güvenlik açığı bırakılmaması hedeflenir.
- REST ve Socket.IO işlemlerinde kullanıcı kimliği doğrulanmış JWT'den alınır; istemcinin gönderdiği kullanıcı kimliğine güvenilmez.
- Sunucu, kanal, mesaj, ses, moderasyon, yükleme ve yönetim işlemlerinde üyelik/yetki backend tarafında kontrol edilir.
- Gizli bilgiler ve yerel kullanıcı verileri `.gitignore` ile Git dışında tutulur.

Uygulamayı internete açarken ayrıca HTTPS/WSS, reverse proxy, yalnızca gerçek alan adını kabul eden CORS, hız sınırlaması, izleme, düzenli yedek ve güvenli sır yönetimi kullanın. Güvenlik bildirimi için [SECURITY.md](SECURITY.md) dosyasına bakın.

## Lisans ve sorumluluk reddi

Bu depo eğitim ve portföy amacıyla, olduğu haliyle sunulur. Garanti veya destek yükümlülüğü yoktur. Yeniden dağıtım ya da ticari kullanım öncesinde depo lisansını ve üçüncü taraf lisanslarını inceleyin.
