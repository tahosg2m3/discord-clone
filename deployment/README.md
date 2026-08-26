# tahosapp bağlantı yapılandırması

Kurulum paketi oluşturulurken `app-config.json` dosyası uygulamanın içine eklenir.
Bu dosyada parola, SMTP şifresi, JWT anahtarı veya başka bir gizli bilgi tutulmaz.

## Şimdiki yerel sürüm

`mode` değeri `local` olduğunda masaüstü uygulaması paketlenmiş yerel backend'i
görünür bir terminal açmadan `127.0.0.1:3001` üzerinde, PeerJS servisini ise
`127.0.0.1:9000` üzerinde başlatır. Her bilgisayarın verileri birbirinden ayrıdır.

## İnternet sunucusuna geçiş

1. Merkezi backend, Socket.IO ve PeerJS servislerini HTTPS/WSS arkasında yayınla.
2. `app-config.remote.example.json` dosyasını örnek alarak `app-config.json`
   içindeki `mode` değerini `remote` yap.
3. `apiOrigin`, `socketUrl` ve PeerJS alanlarını kendi alan adlarınla değiştir.
4. `npm run build` komutuyla yeni kurulum ve otomatik güncelleme paketlerini oluştur.

Uzak mod yalnız HTTPS adreslerini ve güvenli PeerJS bağlantısını kabul eder.
Uzak modda son kullanıcı bilgisayarında paketlenmiş backend başlatılmaz.
Yapılandırma değişikliği mevcut kurulum dosyasını geriye dönük değiştirmez;
yeni bir sürüm numarasıyla yeni kurulum/güncelleme paketi üretilmelidir.

## Canlı sunucuyu güncelleme

Normal bir güncelleme için PowerShell'de proje klasöründe yalnızca şunları çalıştır:

```powershell
git add .
git commit -m "feat: guncelleme aciklamasi"
npm run release:production
```

Son komut masaüstü paketini ve güncelleme doğrulama dosyalarını üretir, commit'i
GitHub'a gönderir, ardından backend + web + masaüstü güncellemesini canlı sunucuya
yükler. Yeni servis sağlık kontrolünü
geçemezse sunucu otomatik olarak önceki çalışan sürüme döner. Veritabanı,
yüklenen dosyalar ve `.env` sunucu sürüm klasörünün dışında tutulduğu için
dağıtım sırasında silinmez veya üzerine yazılmaz.

GitHub'a göndermeden yalnızca sunucuyu güncellemek istersen:

```powershell
npm run deploy:production
```

Yalnız daha önce oluşturulmuş belirli bir masaüstü paketini göndermek için:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deployment/deploy.ps1 -InstallerPath "release\tahosapp-Setup-1.1.2.exe"
```

Kurulu Windows uygulaması açılıştan kısa süre sonra ve her 30 dakikada bir
`https://tahosapp.com.tr/updates/windows/latest.yml` adresini denetler. Yeni paket
SHA-512 doğrulamasından geçtikten sonra arka planda indirilir. Kullanıcı isterse
hemen yeniden başlatır; aksi halde güncelleme normal kapanışta kurulur.

Bilgisayardaki `backend/.env` içinde yalnızca SMTP kullanıcı adı veya uygulama
şifresi değiştiyse, diğer üretim sırlarına dokunmadan canlı sunucuyu güncelle:

```powershell
npm run smtp:production
```

Bu komut yalnızca `SMTP_*` ve `MAIL_FROM` satırlarını aktarır, Gmail bağlantısını
sunucudan sınar ve geçici sır dosyasını bilgisayardan kaldırır.
