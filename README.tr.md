# ewt — Enshrouded Dünya Aracı

Flame Altar dışındaki her alanı **bir sonraki dünya yüklemesinde** sıfırla — oyunun chunk zamanlayıcısını beklemek yok.

*English: [README.md](README.md)*

## Neden

Enshrouded yalnızca Flame Altar yarıçapı içindekini kalıcı tutar. Geri kalan her şey tek bir kayıt bölümünde, `chunk_persistent_data` içinde durur ve motor bunu zamanla budar — oyuncuların "dünya sıfırlandı" dediği şey budur. `ewt` bu bölümü dünya kaydından düşürür; böylece altar dışındaki terraform, açılmış sandıklar ve POI durumu bir sonraki yüklemede yeniden üretilir. Base bölümleri (`baseNN`) baytına kadar kopyalanır.

Motorun zamanlayıcısı chunk bazlıdır ve sürümler arasında değişti. 1.0'da oyuncu gözlemleri **~2 saat / 3 oyun günü** chunk hareketsizliği diyor (resmî wiki hâlâ Erken Erişim 0.7.0.1'deki 30 dakikayı yazıyor). `ewt` bu değere bağlı değil — sıfırlamayı anında uygular.

## Gereksinimler

- Windows
- Node.js 20+
- Enshrouded 1.0+ kayıtları (`.ksd`). 1.0 öncesi hex adlı kayıtlar desteklenmez.

## Kurulum

```bat
git clone https://github.com/furkantiv/enshrouded-worldtool.git
cd enshrouded-worldtool
ewt
```

Bağımlılık ve derleme adımı yok — tek gereksinim Node.js. ZIP indirip `ewt.cmd` ile de çalıştırabilirsin.

## Kullanım

```
ewt            etkileşimli menü
ewt list       dünyaları bul ve durumlarını göster
```

| Komut | Açıklama |
| --- | --- |
| `ewt` | etkileşimli menü |
| `ewt list [--json]` | dünyaları boyut, revizyon ve chunk durumuyla listele |
| `ewt reset [--world n] [--dry-run] [--yes]` | `chunk_persistent_data` bölümünü düşür |
| `ewt verify [--world n]` | tüm bölüm hash'lerini yeniden hesapla |
| `ewt backup` / `ewt backups` | yedek al / listele |
| `ewt restore [--from <dosya>]` | yedeği geri yükle |
| `ewt where` | kayıt konumları (fiziksel yol + Explorer adı) |
| `ewt open [--backups]` | klasörü Explorer'da aç |

Seçim: `--world <n>` (`list` numarası) veya `--path <dosya>`. Ek arama klasörü: `--dir <klasör>`, tekrarlanabilir — örn. dedicated sunucunun `savegame` klasörü.

Dil: `--lang en|tr`. Menüden de değiştirilebilir; seçim `ewt.config.json` içinde hatırlanır. Varsayılan İngilizce.

## Kayıt keşfi

- **Steam Cloud** — `<Steam>\userdata\<id>\1203620\remote\world*.ksd` (Steam yolu kayıt defterinden okunur)
- **Yerel** — `%USERPROFILE%\Saved Games\keen games\Enshrouded\**\world*.ksd`
- **Ek** — `--dir` ile verilen klasörler

Türkçe Windows'ta bazı klasörler yerelleştirilmiş görünür: `Saved Games` → `Kaydedilen Oyunlar`. Fiziksel yol İngilizce kalır; `ewt where` ikisini birlikte gösterir.

## Güvenlik

- `enshrouded.exe` çalışırken yazma reddedilir.
- Her yazmadan önce yedek: `_backups/<dünya>-<guid>/<zaman>.bak` + JSON manifest (sha256, revizyon, kaynak yol).
- Yeniden oluşturma doğrulanır: bölüm sayısı, adları ve kalan tüm bloklar bayt bayt aynı olmalı; bloklar yeniden sıkıştırılmadığı için hash'ler değişmez.
- Atomik yazma (geçici dosya + rename). Doğrulama geçmezse yedek otomatik geri yüklenir.
- Yedekler döner, dünya başına 25 adet.

Steam düzenlemeden sonra bulut çakışması bildirirse **yerel dosyayı yükle** seç.

### Dedicated sunucu

`ewt` kayıt dosyasını düzenler; dünya çalışırken dokunulmaz. Sunucuyu durdur, uygula, tekrar başlat:

```bat
ewt list  --dir "D:\server\savegame"
ewt reset --dir "D:\server\savegame" --world 1
```

Sunucu kapanırken dünyayı diske yazar; açıkken düzenleme yapma. Değişikliğin etkili olması için yeniden başlatma gerekir.

## Nasıl çalışır

Dünya kaydı, isimli bölümlerden oluşan bir `SV2C` konteyneridir: `baseNN` (Flame Altar alanları), `entity_chunk00`, `chunk_persistent_data`, meta veriler vb. `chunk_persistent_data` chunk başına deltaları küçük bir indeksle tutar; oyun zamanla buradan kayıt siler — "reset" tam olarak budur. Bölümün tamamını düşürmek aynı işlemi tek seferde yapar.

Bu geçerli bir durumdur: base dışında hiç düzenleme yapılmamış dünyalar bu bölüm olmadan gelir.

Arka plan notları, format ayrıntıları ve ilk ölçümler: [`.opencode/`](.opencode/).

## Sınırlar

- Bölümün tamamı düşürülür. Chunk bazında cerrahi silme uygulanmadı (bölümün iç checksum'ı çözülmedi).
- Sıkıştırılmış `chunk_persistent_data` listelenemez, ama yine de düşürülebilir.
- Yalnızca kayıt dosyası aracıdır: çalışan oyunla konuşmaz, oyun içi konsol değildir.

## Lisans

MIT — bkz. [LICENSE](LICENSE).
