
const { supabase } = require('./auth');
const config = require('./config');

/**
 * Mengembalikan tanggal kemarin (H-1) dalam format YYYY-MM-DD.
 * @param {string} tanggal - Tanggal referensi YYYY-MM-DD (default: hari ini)
 * @returns {string}
 */
function getYesterdayDate(tanggal = null) {
    const ref = tanggal ? new Date(tanggal) : new Date();
    ref.setDate(ref.getDate() - 1);
    return ref.toISOString().split('T')[0];
}

/**
 * Cek apakah keterangan jurnal siswa pada KEMARIN (H-1) adalah 'izin'.
 * Ini meniru logika platform asli siprakerin.com:
 *   GET /daftar_jurnal?select=keterangan&id_siswa=eq.{id}&tanggal=eq.{kemarin}
 * Jika hasilnya 'izin' → platform menampilkan toggle "Izin Lanjutan".
 *
 * @param {string} id_siswa
 * @param {string} tanggal - Tanggal hari ini (YYYY-MM-DD)
 * @returns {boolean} true jika kemarin izin
 */
async function checkKemarinIzin(id_siswa, tanggal) {
    const kemarin = getYesterdayDate(tanggal);
    console.log(`[izin lanjutan] Mengecek keterangan kemarin (${kemarin}) untuk siswa ${id_siswa}...`);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .select('keterangan')
        .eq('id_siswa', id_siswa)
        .eq('tanggal', kemarin)
        .maybeSingle();

    if (error) {
        console.warn('[izin lanjutan] Gagal cek kemarin:', error.message);
        return false;
    }

    const isKemarinIzin = data?.keterangan === 'izin';
    console.log(`[izin lanjutan] Status kemarin (${kemarin}): "${data?.keterangan ?? 'tidak ada'}" → izin lanjutan ${isKemarinIzin ? 'TERSEDIA' : 'tidak tersedia'}`);
    return isKemarinIzin;
}

/**
 * Fetch UID foto dari entry izin terakhir SEBELUM tanggal yang diberikan.
 * Token diambil otomatis dari sesi Supabase yang aktif (hasil login).
 *
 * @param {string} id_siswa
 * @param {string} tanggal - Tanggal hari ini (YYYY-MM-DD); fetch mencari entry < tanggal ini
 * @returns {string|null} - Path foto (contoh: "<uuid>/nama_file.png") atau null jika tidak ada
 */
async function getLastIzinFoto(id_siswa, tanggal) {
    console.log(`[izin lanjutan] Mencari foto izin sebelum tanggal ${tanggal} untuk siswa ${id_siswa}...`);

    // Ambil token dari sesi Supabase yang sudah login — tidak perlu inject manual
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
        console.warn('[izin lanjutan] Tidak ada sesi aktif — tidak bisa fetch foto kemarin.');
        return null;
    }

    const baseUrl = `${config.SUPABASE_URL}/rest/v1`;
    // Filter: keterangan=izin, foto tidak null, foto tidak kosong, tanggal < hari ini, urut desc, ambil 1
    const query = [
        `select=foto`,
        `id_siswa=eq.${id_siswa}`,
        `keterangan=eq.izin`,
        `foto=not.is.null`,
        `foto=neq.`,
        `tanggal=lt.${tanggal}`,
        `order=tanggal.desc`,
        `limit=1`
    ].join('&');

    const url = `${baseUrl}/daftar_jurnal?${query}`;

    const res = await fetch(url, {
        headers: {
            'apikey': config.SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'accept': '*/*',
            'accept-profile': 'public'
        }
    });

    if (!res.ok) {
        const text = await res.text();
        console.warn(`[izin lanjutan] Gagal fetch foto kemarin: ${res.status} - ${text}`);
        return null;
    }

    const data = await res.json();

    if (!data || data.length === 0 || !data[0].foto) {
        console.log('[izin lanjutan] Tidak ada foto izin sebelumnya ditemukan.');
        return null;
    }

    console.log(`[izin lanjutan] Foto kemarin ditemukan: ${data[0].foto}`);
    return data[0].foto;
}

async function getStudentDetails(user) {
    // 1. Prefer Environment Variables (Overrides)
    if (config.ID_SISWA && config.ID_KELAS && config.ID_INDUSTRI) {
        console.log('Menggunakan konfigurasi ID manual dari .env');
        return {
            id_siswa: config.ID_SISWA,
            id_kelas: config.ID_KELAS,
            id_industri: config.ID_INDUSTRI
        };
    }

    // 2. Use User ID from Login (This is the id_siswa)
    const id_siswa = user.id;

    // If we are missing class/industry, try to fetch from DB
    if (!config.ID_KELAS || !config.ID_INDUSTRI) {

        try {
            const { data, error } = await supabase
                .from('daftar_siswa')
                .select(`
                    id_kelas, 
                    id_industri, 
                    nama, 
                    nis, 
                    keahlian,
                    daftar_industri (
                        nama_industri
                    ),
                    daftar_kelas (
                        nama_kelas
                    )
                `)
                .eq('id_siswa', id_siswa) // Query by UUID is safer/faster
                .single();

            if (error) {
                console.warn('Gagal fetch otomatis detail tambahan:', error.message);
                console.warn('Fallback: Pastikan ID_KELAS dan ID_INDUSTRI ada di .env jika script gagal submit.');
            } else {
                return {
                    id_siswa,
                    id_kelas: data.id_kelas,
                    id_industri: data.id_industri,
                    nama_kelas: data.daftar_kelas?.nama_kelas || 'Unknown',
                    nama_industri: data.daftar_industri?.nama_industri || 'Unknown',
                    nama: data.nama,
                    nis: data.nis,
                    keahlian: data.keahlian
                };
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Fallback or Mixed Config
    return {
        id_siswa,
        id_kelas: config.ID_KELAS, // May be undefined if fetch failed and not in env
        id_industri: config.ID_INDUSTRI
    };
}




/**
 * Submit jurnal harian.
 *
 * @param {string|null} token        - Bearer token (diperlukan untuk izin lanjutan)
 * @param {string}      activity     - Kegiatan
 * @param {object}      studentIds   - { id_siswa, id_kelas, id_industri }
 * @param {string}      keterangan   - 'hadir' | 'izin' | dst. (default: 'hadir')
 * @param {string|null} tanggal      - YYYY-MM-DD (default: hari ini)
 * @param {boolean}     izinLanjutan - Jika true & keterangan='izin': gunakan foto izin dari hari kemarin.
 *                                     Default FALSE — user harus upload foto baru.
 */
async function submitJournal(token, activity, studentIds, keterangan = 'hadir', tanggal = null, izinLanjutan = false) {
    // Use provided tanggal or default to today
    const journalDate = tanggal || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Date range validation: Only allow dates between 2026-01-05 and 2026-10-01
    const minDate = new Date('2026-01-05');
    const maxDate = new Date('2026-10-01');
    const submittedDate = new Date(journalDate);

    if (submittedDate < minDate) {
        const errorMsg = `Tanggal ${journalDate} terlalu lama. Jurnal hanya dapat dibuat mulai dari 5 Januari 2026.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    if (submittedDate > maxDate) {
        const errorMsg = `Tanggal ${journalDate} terlalu jauh. Jurnal hanya dapat dibuat hingga 1 Oktober 2026.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const payload = {
        id_siswa: studentIds.id_siswa,
        tanggal: journalDate,
        kegiatan: activity,
        keterangan: keterangan,
        id_industri: studentIds.id_industri,
        id_kelas: studentIds.id_kelas
    };

    // Check for existing journal entry on the same date (regardless of status)
    const { data: existingEntries, error: checkError } = await supabase
        .from('daftar_jurnal')
        .select('id_jurnal, keterangan')
        .eq('id_siswa', studentIds.id_siswa)
        .eq('tanggal', journalDate);

    if (checkError) {
        console.error('Error checking duplicate:', checkError.message);
        throw checkError;
    }

    if (existingEntries && existingEntries.length > 0) {
        const existingStatus = existingEntries[0].keterangan;
        const errorMsg = `Jurnal untuk tanggal ${journalDate} sudah ada dengan status "${existingStatus}". Tidak dapat membuat jurnal duplikat untuk tanggal yang sama.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    console.log(`Mengirim absen siswa pada ${journalDate}:`, payload.kegiatan);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .insert([payload])
        .select();

    if (error) {
        if (error.message.includes('duplicate key') || error.code === '23505') {
            const friendlyError = `Jurnal dengan keterangan "${keterangan}" untuk tanggal ${journalDate} sudah ada. Gunakan tanggal lain atau pilih keterangan berbeda.`;
            console.error('Duplicate entry:', friendlyError);
            throw new Error(friendlyError);
        }

        console.error('Gagal mengirim absen siswa:', error.message);
        throw error;
    }

    console.log('Absen siswa berhasil dikirim:', data);

    // --- Logika Izin Lanjutan ---
    // Hanya dijalankan jika: keterangan='izin', izinLanjutan=true, token tersedia, dan insert berhasil
    if (keterangan === 'izin' && izinLanjutan && data && data[0]) {
        const newJurnalId = data[0].id_jurnal;
        console.log(`[izin lanjutan] Mode aktif. Mencari foto izin sebelumnya untuk dijadikan foto jurnal #${newJurnalId}...`);

        try {
            const fotoKemarin = await getLastIzinFoto(studentIds.id_siswa, journalDate);

            if (fotoKemarin) {
                // PATCH foto kemarin ke jurnal baru — menghemat storage (tidak upload ulang)
                const { error: patchError } = await supabase
                    .from('daftar_jurnal')
                    .update({ foto: fotoKemarin })
                    .eq('id_jurnal', newJurnalId);

                if (patchError) {
                    console.warn(`[izin lanjutan] Gagal patch foto ke jurnal baru: ${patchError.message}`);
                } else {
                    console.log(`[izin lanjutan] Foto "${fotoKemarin}" berhasil di-reuse untuk jurnal #${newJurnalId}.`);
                    data[0].foto = fotoKemarin; // Update return value agar konsisten
                }
            } else {
                console.log('[izin lanjutan] Tidak ada foto sebelumnya — jurnal dibuat tanpa foto (user perlu upload manual).');
            }
        } catch (izinErr) {
            // Jangan gagalkan submit utama hanya karena izin lanjutan gagal
            console.warn('[izin lanjutan] Error saat proses izin lanjutan (jurnal tetap tersimpan):', izinErr.message);
        }
    } else if (keterangan === 'izin' && !izinLanjutan) {
        console.log('[izin] Mode default: bukan izin lanjutan. User perlu upload foto baru secara manual.');
    }
    // --- End Logika Izin Lanjutan ---

    return data;
}

// Updated with Pagination Support
async function getJournalHistory(token, userId, { page = 1, limit = 10 } = {}) {
    console.log(`Fetching Journal History (Page ${page}, Limit ${limit})...`);

    // Helper for direct REST Fetch if needed (User Preference)
    const fetchTable = async (tableName, query = '') => {
        const baseUrl = `${config.SUPABASE_URL}/rest/v1`;
        const url = `${baseUrl}/${tableName}${query}`;

        const headers = {
            'apikey': config.SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gagal fetch ${tableName}: ${res.status} ${res.statusText} - ${text}`);
        }
        return res.json();
    };

    try {
        // Calculate Offset
        const offset = (page - 1) * limit;

        // Fetch Jurnal (Paginated)
        const queryJurnal = `?select=*&id_siswa=eq.${userId}&order=tanggal.desc&limit=${limit}&offset=${offset}`;
        const journals = await fetchTable('daftar_jurnal', queryJurnal);

        if (!journals || journals.length === 0) {
            console.log("Tidak ada riwayat jurnal pada halaman ini.");
            return [];
        }

        console.log(`Berhasil load ${journals.length} item history.`);
        return journals;

    } catch (err) {
        console.error("Gagal mengambil history jurnal:", err.message);
        throw err;
    }
}

async function deleteJournal(id_jurnal) {
    console.log(`Menghapus jurnal dengan ID: ${id_jurnal}`);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .delete()
        .eq('id_jurnal', id_jurnal)
        .select();

    if (error) {
        console.error('Gagal menghapus jurnal:', error.message);
        throw error;
    }

    console.log('Jurnal berhasil dihapus:', data);
    return data;
}

async function updateJournal(id_jurnal, updates) {
    console.log(`Mengupdate jurnal ${id_jurnal}:`, updates);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .update(updates)
        .eq('id_jurnal', id_jurnal)
        .select();

    if (error) {
        // Check for duplicate key error
        if (error.message.includes('duplicate key') || error.code === '23505') {
            const friendlyError = `Update gagal: Kombinasi tanggal dan keterangan sudah ada. Gunakan nilai yang berbeda.`;
            console.error('Duplicate entry:', friendlyError);
            throw new Error(friendlyError);
        }

        console.error('Gagal mengupdate jurnal:', error.message);
        throw error;
    }

    console.log('Jurnal berhasil diupdate:', data);
    return data;
}

/**
 * Upload foto surat izin ke Supabase Storage (bucket: 'izin') lalu PATCH jurnal.
 * Meniru persis flow platform asli siprakerin.com:
 *   1. PUT /storage/v1/object/izin/{id_siswa}/{timestamp}_{filename}
 *   2. PATCH daftar_jurnal set foto = "{id_siswa}/{timestamp}_{filename}"
 *
 * @param {string}  id_jurnal  - ID jurnal yang sudah dibuat
 * @param {string}  id_siswa   - UUID siswa (jadi prefix path di storage)
 * @param {Buffer}  fileBuffer - Buffer isi file
 * @param {string}  fileName   - Nama file asli (e.g. "surat_izin.png")
 * @param {string}  mimeType   - MIME type (e.g. "image/png")
 * @returns {{ fotoPath: string }} path foto yang tersimpan
 */
async function uploadFotoIzin(id_jurnal, id_siswa, fileBuffer, fileName, mimeType) {
    // Format path: {id_siswa}/{timestamp_ms}_{nama_file}  ← persis seperti platform asli
    const timestamp = Date.now();
    const fotoPath = `${id_siswa}/${timestamp}_${fileName}`;

    console.log(`[upload foto] Mengupload ke bucket 'izin': ${fotoPath}`);

    // 1. Upload ke Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('izin')
        .upload(fotoPath, fileBuffer, {
            contentType: mimeType,
            upsert: false
        });

    if (uploadError) {
        console.error('[upload foto] Gagal upload ke storage:', uploadError.message);
        throw new Error(`Gagal upload foto: ${uploadError.message}`);
    }

    console.log(`[upload foto] Upload berhasil: ${uploadData.path}`);

    // 2. PATCH foto path ke jurnal (sama seperti platform: body = { foto: path })
    const { error: patchError } = await supabase
        .from('daftar_jurnal')
        .update({ foto: fotoPath })
        .eq('id_jurnal', id_jurnal);

    if (patchError) {
        console.error('[upload foto] Gagal patch foto ke jurnal:', patchError.message);
        throw new Error(`Foto terupload tapi gagal disimpan ke jurnal: ${patchError.message}`);
    }

    console.log(`[upload foto] Foto berhasil dikaitkan ke jurnal #${id_jurnal}: ${fotoPath}`);
    return { fotoPath };
}

module.exports = {
    getStudentDetails,
    getYesterdayDate,
    checkKemarinIzin,
    getLastIzinFoto,
    uploadFotoIzin,
    submitJournal,
    getJournalHistory,
    deleteJournal,
    updateJournal
};
