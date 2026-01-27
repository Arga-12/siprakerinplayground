
const { supabase } = require('./auth');
const config = require('./config');

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
    console.log(`User ID (id_siswa) ditemukan: ${id_siswa}`);

    // If we are missing class/industry, try to fetch from DB
    if (!config.ID_KELAS || !config.ID_INDUSTRI) {
        console.log('Mencari detail kelas/industri di database...');

        try {
            const { data, error } = await supabase
                .from('daftar_siswa')
                .select('id_kelas, id_industri, nama, nis, keahlian')
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




async function submitJournal(token, activity, studentIds, keterangan = 'hadir', tanggal = null) {
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

        // 1. Fetch Jurnal Utama (Paginated)
        // Menggunakan param offset & limit di URL
        const queryJurnal = `?select=*&id_siswa=eq.${userId}&order=tanggal.desc&limit=${limit}&offset=${offset}`;
        const journals = await fetchTable('daftar_jurnal', queryJurnal);

        if (!journals || journals.length === 0) {
            console.log("Tidak ada riwayat jurnal pada halaman ini.");
            return [];
        }

        // 2. Fetch Detail Izin (jika ada yang izin)
        const izinJournals = journals.filter(j => j.keterangan === 'izin');
        let izinMap = {};

        if (izinJournals.length > 0) {
            const journalIds = izinJournals.map(j => j.id_jurnal);
            const queryIds = `(${journalIds.join(',')})`;

            // Fetch daftar_izin
            const izinData = await fetchTable('daftar_izin', `?select=*&id_jurnal=in.${queryIds}`);

            // Buat Map id_jurnal -> data_izin untuk O(1) access
            izinData.forEach(item => {
                izinMap[item.id_jurnal] = item;
            });
        }

        // 3. Gabungkan Data
        const enrichedJournals = journals.map(j => {
            if (j.keterangan === 'izin' && izinMap[j.id_jurnal]) {
                return {
                    ...j,
                    detail_izin: izinMap[j.id_jurnal] // Attach detail foto/etc
                };
            }
            return j;
        });

        console.log(`Berhasil load ${enrichedJournals.length} item history.`);
        return enrichedJournals;

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

module.exports = {
    getStudentDetails,
    submitJournal,
    getJournalHistory,
    deleteJournal,
    updateJournal
};
