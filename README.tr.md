<p align="right">
🌍 Dil:
<a href="README.md">English</a> |
<a href="README.tr.md">Türkçe</a>
</p>
Özellikler✅ Gerçek zamanlı mesajlaşma (Socket.io)✅ WebRTC ile ses kanalları✅ Ekran paylaşımı✅ GIF desteği (Tenor API)✅ Kullanıcı kimlik doğrulaması (JWT)✅ Çoklu sunucu ve kanal✅ Masaüstü uygulaması (Electron - Windows/Mac/Linux)✅ Web uygulaması✅ Yazıyor göstergeleri✅ Çevrimiçi kullanıcı listesiTeknoloji YığınıFrontend: React, Vite, Tailwind CSS, Socket.io-client, PeerJSBackend: Node.js, Express, Socket.io, JWT, bcryptMasaüstü: ElectronVeritabanı: Bellek içi (In-memory) (MongoDB hazır)🚀 Geliştirme Kurulumu1. Depoyu KlonlayınBashgit clone https://github.com/tahosg2m3/discord-clone.git
cd discord-clone
2. Bağımlılıkları YükleyinBashnpm install
3. Ortam Değişkenlerini Ayarlayınbackend/.envPORT=3001
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development
4. Geliştirme Sunucularını ÇalıştırınSeçenek A: Hepsi bir aradaBashnpm run dev
Seçenek B: Ayrı terminallerBash# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Electron (frontend başladıktan sonra)
npm run dev:electron
5. Uygulamaya ErişimWeb: http://localhost:5173Masaüstü: Electron penceresi otomatik olarak açılacaktır📦 Prodüksiyon (Canlı) İçin DerlemeWeb UygulamasıBashcd frontend
npm run build
Masaüstü UygulamasıWindows:Bashnpm run build
# Çıktı: release/Discord Clone Setup.exe
macOS:Bashnpm run build
# Çıktı: release/Discord Clone.dmg
Linux:Bashnpm run build
# Çıktı: release/Discord Clone.AppImage
🎮 Kullanım1. Hesap OluşturmaUygulamayı açın"Sign Up" (Kayıt Ol) butonuna tıklayınKullanıcı adı, e-posta ve şifre girin"Create Account" (Hesap Oluştur) butonuna tıklayın2. Sunucuya KatılmaVarsayılan sunucu solda görünürSunucu simgesine tıklayınBir kanal seçin3. Yazılı SohbetGiriş kutusuna mesaj yazınGöndermek için Enter'a basınGIF göndermek için GIF butonuna tıklayın4. Sesli SohbetBir ses kanalına tıklayınKatılmak için mikrofon butonuna tıklayınKontroller: Sustur, Sağırlaştır, Ekran Paylaş, Ayrıl5. Sunucu OluşturmaSol kenar çubuğundaki "+" butonuna tıklayınSunucu adını girinYeni sunucu görünecektir🔧 YapılandırmaBackend Portubackend/.env dosyasında değiştirin:PORT=3001
Frontend Portufrontend/vite.config.js dosyasında değiştirin:JavaScriptexport default defineConfig({
  server: {
    port: 5173,
  },
})
PeerJS SunucusuSes/video için PeerJS sunucusunu çalıştırın:Bashnpm install -g peer
peerjs --port 9000
Veya VoiceContext.jsx içinde genel PeerJS bulut sunucusunu kullanın:JavaScriptconst newPeer = new Peer(user.id, {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
});
🐛 Sorun Giderme"Cannot find module 'bcrypt'"Bashcd backend
npm install bcrypt jsonwebtoken
Ses çalışmıyorPeerJS sunucusunun çalıştığını kontrol edinMikrofon izinlerini kontrol edinHatalar için tarayıcı konsolunu kontrol edinElectron uygulaması başlamıyorBashnpm install electron electron-builder --save-dev
Port zaten kullanımdaBash# 3001 portundaki işlemi sonlandır
lsof -ti:3001 | xargs kill -9

# 5173 portundaki işlemi sonlandır
lsof -ti:5173 | xargs kill -9
📱 Platform DesteğiPlatformDurumFormatWindows✅.exe yükleyicimacOS✅.dmgLinux✅.AppImage, .debWeb✅Tarayıcı🔐 Güvenlik Notları⚠️ ÖNEMLİ: Bu bir geliştirme kurulumudur. Prodüksiyon için:.env içindeki JWT_SECRET değerini değiştirinHTTPS kullanınHız sınırlaması (rate limiting) ekleyinUygun bir veritabanı kullanın (MongoDB)Tüm girdileri doğrulayınOrtam değişkenlerini kullanınCORS'u yalnızca kendi alan adınız için etkinleştirinŞifreleri uygun şekilde hash'leyin (bcrypt ile zaten yapıldı)📄 LisansMIT Lisansı - Öğrenme ve kişisel projeler için kullanmaktan çekinmeyin