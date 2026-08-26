# tahosapp Cloudflare production ayarları

26 Ağustos 2026 tarihinde doğrulanan yapılandırma:

## DNS

| Tür | Ad | Hedef | Durum |
| --- | --- | --- | --- |
| A | `@` | `188.191.107.157` | Proxied |
| A | `api` | `188.191.107.157` | Proxied |
| A | `voice` | `188.191.107.157` | Proxied |
| A | `turn` | `188.191.107.157` | DNS only |
| CNAME | `www` | `tahosapp.com.tr` | Proxied |

`turn` kaydı gri bulutta kalmalıdır. Normal Cloudflare proxy'si TURN'un
`3478/udp`, `3478/tcp` ve relay UDP portlarını taşımaz. Bu kaydı turuncu buluta
almak ses bağlantısını bozabilir.

## SSL/TLS ve ağ

- SSL/TLS encryption mode: **Full (strict)**
- Always Use HTTPS: **On**
- Minimum TLS Version: **TLS 1.2**
- TLS 1.3: **On**
- Automatic HTTPS Rewrites: **On**
- WebSockets: **On**
- Universal SSL certificate: **Active**

## DDoS koruması

- SSL/TLS DDoS attack protection: **Active**
- Network-layer DDoS attack protection: **Active**
- HTTP DDoS attack protection: Cloudflare tarafından sürekli etkin

Socket.IO ve PeerJS gerçek zamanlı bağlantıları nedeniyle genel bir JavaScript
Challenge, Cache Everything veya agresif bot kuralı `api`/`voice` alt alanlarına
uygulanmamalıdır. Kimlik doğrulama hız sınırları ayrıca backend'de uygulanır.

## Bilinçli olarak açılmayan ayar

DNSSEC, alan adı kayıt firmasındaki DS kaydı tamamlanmadan açılmamalıdır.
Cloudflare'ın gösterdiği DS bilgisi turkticaret.net paneline girildiği anda
DNSSEC güvenle etkinleştirilebilir; yarım bırakılması alan adını erişilemez hale
getirebilir.
