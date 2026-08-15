# Geri bildirim sesleri

Ses dosyalarını bu klasöre koy. Desteklenen biçimler: `.mp3`, `.wav`, `.ogg`.
Dosya ekledikten veya değiştirdikten sonra frontend geliştirme sunucusunu yeniden başlat.

Kullanılacak dosya adları:

- `message.mp3`
- `deafen.mp3`
- `undeafen.mp3`
- `mute.mp3`
- `unmute.mp3`
- `leave-call.mp3`
- `ptt-activate.mp3`
- `ptt-deactivate.mp3`
- `user-joins.mp3`
- `user-leaves.mp3`
- `moved.mp3`
- `outgoing-call.mp3`
- `stream-started.mp3`
- `stream-stopped.mp3`
- `user-joined-stream.mp3`
- `user-left-stream.mp3`
- `incoming-call.mp3`

Dosya adlarını küçük harfle ve tireli kullan. Bir ses dosyası eksikse uygulama hata vermez; yalnızca o bildirim sessiz kalır.

`outgoing-call.mp3` arayan tarafta, `incoming-call.mp3` aranan tarafta en fazla 30 saniye döngüde çalar. Arama kabul, ret veya iptal edildiğinde ses hemen kesilir. `moved.mp3` ise yetkili bir moderatör kullanıcıyı başka ses kanalına taşıdığında taşınan kullanıcıda çalar.
