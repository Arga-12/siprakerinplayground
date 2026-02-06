# Siprakerin fetching datas playground

Ini adalah project gabut yang aku buat untuk membantu ku bermain-main supabase mengunakan fetching dengan **JavaScript** *hehe*. Dengan memiliki logic fetching2 yang ada seperti:

 - Menggunakan kredensial user dari `.env` untuk memiliki token bearer yang nanti digunakan sebagai izin mengambil dan mengirim data fetching di supabase **Siprakerin**
 - Mengirim (memfetching) data kehadiran dengan keterangan `hadir` dan `libur` saja (untuk saat ini, buat `izin` gadapat izin untuk ngakses bucket sebagai tingkat user biasa), serta bisa memilih tanggal kehadiran yang ingin dipilih.
 - Automasi hadir sekali setiap booting laptop atau pc akan diterapkan terlebih dahulu menggunakan `linux` (karena punya setting untuk menjalankan command setiap booting) *cooming soon~*
 
>  Be a white hat not black hat, ok?

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
Unexpected juga bahwa logic siprakerin tidak memfilter atau mengamankan value tanggal agar supabase hanya menerima tanggal secara realtime saja, bukan tanggal yang bisa diatur sesuka hati oleh client. *makasih yak*

## Want to use it?
*Script yang telah kamu ubah sendirinya untuk keperluanmu sendiri bukanlah tanggung jawab saya jika mengalami kesalahan.*

Satu command persiapan tinggal copas di terminal mu:
```
# Clone dulu reponya
git clone https://github.com/Arga-12/siprakerinplayground.git
cd siprakerinplayground
# Install UI dependencies
cd ui
npm install
# Install automation dependencies
cd ../automasi
npm install
# Kembali ke UI untuk menjalankan server local
cd ../ui
```

**Isi kredensial akun email dan password mu sesuai kredensialmu dari Siprakerin**

 1. copas isi dari `.env.example`
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
EMAIL=your_email@example.com
PASSWORD=your_password_here
```

2. bikin file `.env` dan paste isinya disini
```
SUPABASE_URL=kunjungi protofolio grafikarsa user Argandull
SUPABASE_ANON_KEY=kunjungi protofolio grafikarsa user Argandull
EMAIL=your_email@example.com
PASSWORD=your_password_here
```
3. Wajib menjalankan server local melaui **/ui** bukan **/automasi**
```
# Didalam folder /ui
npm run dev
# Pastikan dulu file `.env` berada diluar /ui dan /automasi serta sudah diisi kredensial asli mu
```

Well done, silahkan isi kehadiran kemarin jika lupa.. `jangan boong lo yaa :3`