# Siprakerin fetching datas playground

Ini adalah project gabut yang aku buat untuk membantu ku bermain-main supabase mengunakan fetching dengan **JavaScript** _hehe_. Dengan memiliki logic fetching2 yang ada seperti:

- Menggunakan kredensial user dari `.env` untuk memiliki token bearer yang nanti digunakan sebagai izin mengambil dan mengirim data fetching di supabase **Siprakerin**
- Mengirim (memfetching) data kehadiran dengan keterangan `hadir` dan `libur` saja (untuk saat ini, karena keterangan `izin` gadapat izin untuk ngakses bucket sebagai tingkat user biasa, masih belum bisa mengabsen dengan keterangan `izinnnnnnnn`), serta bisa memilih tanggal kehadiran yang ingin dipilih.
- Automasi hadir sekali setiap booting laptop atau pc akan diterapkan terlebih dahulu menggunakan `linux` (karena punya setting untuk menjalankan command setiap booting) _cooming soon~_

> Be a white hat not black hat, ok?

Logic yang kuberikan hanya mengbypass peraturan tidak bisa memilih tanggal kehadiran saja, serta mengeset nilai dari keterangan dan kegiatan:

```
# Jika kalian inspect sendiri request yang dikirim ke siprakerin kurang lebih bentuknya sama seperti ini
const  payload  = {
	id_siswa:  studentIds.id_siswa,
	tanggal:  journalDate,
	kegiatan:  activity,
	keterangan:  keterangan,
	id_industri:  studentIds.id_industri,
	id_kelas:  studentIds.id_kelas
};
```

Unexpected juga bahwa logic siprakerin tidak memfilter atau mengamankan value tanggal agar supabase hanya menerima tanggal secara realtime saja, bukan tanggal yang bisa diatur sesuka hati oleh client. _makasih yak_

## Want to use it?

_Script yang telah kamu ubah sendirinya untuk keperluanmu sendiri bukanlah tanggung jawab saya jika mengalami kesalahan._

### Setup Awal

**1. Clone dan Install Dependencies**

```bash
# Clone dulu reponya
git clone https://github.com/Arga-12/siprakerinplayground.git
cd siprakerinplayground

# Install UI dependencies
cd ui
npm install

# Install automation dependencies
cd ../automasi
npm install

# Kembali ke root project
cd ..
```

**2. Setup Kredensial (.env)**

Buat file `.env` di **root folder** (sejajar dengan folder `ui` dan `automasi` // diluar folder `ui` dan `automasi`), lalu isi dengan kredensial mu:

```env
SUPABASE_URL=kunjungi portofolio grafikarsa user Argandull
SUPABASE_ANON_KEY=kunjungi portofolio grafikarsa user Argandull
EMAIL=your_email@example.com
PASSWORD=your_password_here
```

> Kamu bisa copas dari `.env.example` sebagai template

**3. Build Tailwind CSS (Wajib!)**

Sebelum pertama kali menjalankan server, kamu **HARUS** build Tailwind CSS dulu (biar gak burik mas):

```bash
# Dari root folder, pindah ke /ui
cd ui

# Build CSS (hanya sekali atau jika ada perubahan styling)
npm run build:css
```

**All donee!** enjoy your playground

---

### Menjalankan Aplikasi

#### **Opsi 1: Development Mode (Recommended)**

Mode ini akan auto-rebuild CSS setiap kali kamu ubah file `input.css`:

```bash
# Dari folder /ui
npm run watch:css
```

Lalu di terminal baru, jalankan server:

```bash
# Dari folder /ui (terminal baru)
npm run dev
```

#### **Opsi 2: Production Mode**

Jika tidak ada perubahan styling, cukup jalankan server saja:

```bash
# Dari folder /ui
npm run dev
```

> **Catatan:** Pastikan file `.env` berada di **root folder** (diluar /ui dan /automasi)

---

### Untuk Menyalakan Ulang Server

```bash
# Dari /siprakerinplayground (root folder)
cd ui
npm run dev
```

> **Penting:** Jika kamu ubah styling di `input.css`, jalankan `npm run build:css` atau `npm run watch:css` dulu sebelum reload browser!

---

### Script yang Tersedia

Di folder `/ui`, kamu bisa gunakan script berikut:

| Script              | Fungsi                                                    |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Jalankan server development dengan nodemon                |
| `npm run start`     | Jalankan server production                                |
| `npm run build:css` | Build Tailwind CSS sekali (untuk production)              |
| `npm run watch:css` | Auto-rebuild CSS setiap ada perubahan (untuk development) |

Well done, silahkan isi kehadiran kemarin jika lupa.. `jangan boong lo yaa :3`