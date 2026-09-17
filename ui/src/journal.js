const { supabase } = require('./auth');
const config = require('./config');

//Ambil tanggal H-1 dari referensi yang dikasih
function getYesterdayDate(tanggal = null) {
    const ref = tanggal ? new Date(tanggal) : new Date();
    ref.setDate(ref.getDate() - 1);
    return ref.toISOString().split('T')[0];
}

//cek apakah jurnal kemarin keterangan 'izin' — buat toggle izin lanjutan
async function checkKemarinIzin(id_siswa, tanggal) {
    const kemarin = getYesterdayDate(tanggal);
    console.log(`[extended-permission] Checking yesterday's status (${kemarin}) for student ${id_siswa}...`);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .select('keterangan')
        .eq('id_siswa', id_siswa)
        .eq('tanggal', kemarin)
        .maybeSingle();

    if (error) {
        console.warn('[extended-permission] Failed to check yesterday:', error.message);
        return false;
    }

    const isKemarinIzin = data?.keterangan === 'izin';
    console.log(`[extended-permission] Yesterday status (${kemarin}): "${data?.keterangan ?? 'none'}" → extended permission ${isKemarinIzin ? 'AVAILABLE' : 'not available'}`);
    return isKemarinIzin;
}

//ambil path foto izin dari entry terakhir sebelum tanggal tertentu
async function getLastIzinFoto(id_siswa, tanggal) {
    console.log(`[extended-permission] Looking for a permission photo before date ${tanggal} for student ${id_siswa}...`);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
        console.warn('[extended-permission] No active session — cannot fetch yesterday\'s photo.');
        return null;
    }

    const baseUrl = `${config.SUPABASE_URL}/rest/v1`;
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
        console.warn(`[extended-permission] Failed to fetch yesterday's photo: ${res.status} - ${text}`);
        return null;
    }

    const data = await res.json();

    if (!data || data.length === 0 || !data[0].foto) {
        console.log('[extended-permission] No previous permission photo found.');
        return null;
    }

    console.log(`[extended-permission] Yesterday's photo found: ${data[0].foto}`);
    return data[0].foto;
}

async function getStudentDetails(user) {
    if (config.ID_SISWA && config.ID_KELAS && config.ID_INDUSTRI) {
        console.log('Using manual ID configuration from .env');
        return {
            id_siswa: config.ID_SISWA,
            id_kelas: config.ID_KELAS,
            id_industri: config.ID_INDUSTRI
        };
    }

    const id_siswa = user.id;

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
                .eq('id_siswa', id_siswa)
                .single();

            if (error) {
                console.warn('Failed to auto-fetch additional details:', error.message);
                console.warn('Fallback: Make sure ID_KELAS and ID_INDUSTRI exist in .env if the script fails to submit.');
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

    return {
        id_siswa,
        id_kelas: config.ID_KELAS,
        id_industri: config.ID_INDUSTRI
    };
}

//submit jurnal harian — token cuma dipake buat izin lanjutan
async function submitJournal(token, activity, studentIds, keterangan = 'hadir', tanggal = null, izinLanjutan = false) {
    const journalDate = tanggal || new Date().toISOString().split('T')[0];

    const minDate = new Date('2026-01-05');
    const maxDate = new Date('2026-10-01');
    const submittedDate = new Date(journalDate);

    if (submittedDate < minDate) {
        const errorMsg = `Date ${journalDate} is too old. Journals can only be created starting from January 5, 2026.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    if (submittedDate > maxDate) {
        const errorMsg = `Date ${journalDate} is too far ahead. Journals can only be created until October 1, 2026.`;
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

    //cek duplikat — satu tanggal cuma boleh satu jurnal
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
        const errorMsg = `A journal for ${journalDate} already exists with status "${existingStatus}". Cannot create a duplicate journal for the same date.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    console.log(`Submitting attendance for ${journalDate}:`, payload.kegiatan);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .insert([payload])
        .select();

    if (error) {
        if (error.message.includes('duplicate key') || error.code === '23505') {
            const friendlyError = `A journal with status "${keterangan}" for ${journalDate} already exists. Use another date or choose a different status.`;
            console.error('Duplicate entry:', friendlyError);
            throw new Error(friendlyError);
        }

        console.error('Failed to submit attendance:', error.message);
        throw error;
    }

    console.log('Attendance submitted successfully:', data);

    //extended permission: reuse photo from the previous permission journal
    if (keterangan === 'izin' && izinLanjutan && data && data[0]) {
        const newJurnalId = data[0].id_jurnal;
        console.log(`[extended-permission] Mode active. Looking for a previous permission photo to reuse for journal #${newJurnalId}...`);

        try {
            const fotoKemarin = await getLastIzinFoto(studentIds.id_siswa, journalDate);

            if (fotoKemarin) {
                const { error: patchError } = await supabase
                    .from('daftar_jurnal')
                    .update({ foto: fotoKemarin })
                    .eq('id_jurnal', newJurnalId);

                if (patchError) {
                    console.warn(`[extended-permission] Failed to patch photo to the new journal: ${patchError.message}`);
                } else {
                    console.log(`[extended-permission] Photo "${fotoKemarin}" successfully reused for journal #${newJurnalId}.`);
                    data[0].foto = fotoKemarin;
                }
            } else {
                console.log('[extended-permission] No previous photo — journal created without photo (user needs to upload manually).');
            }
        } catch (izinErr) {
            console.warn('[extended-permission] Error during extended-permission flow (journal still saved):', izinErr.message);
        }
    } else if (keterangan === 'izin' && !izinLanjutan) {
        console.log('[permission] Default mode: not extended permission. User needs to upload a new photo manually.');
    }

    return data;
}

//ambil semua jurnal milik user — tanpa batas, biar client yang handle paginasi
async function getJournalHistory(token, userId) {
    console.log(`Fetching ALL Journal History for user ${userId}...`);

    const baseUrl = `${config.SUPABASE_URL}/rest/v1`;
    const url = `${baseUrl}/daftar_jurnal?select=*&id_siswa=eq.${userId}&order=tanggal.desc`;

    const headers = {
        'apikey': config.SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const res = await fetch(url, { headers });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch daftar_jurnal: ${res.status} ${res.statusText} - ${text}`);
    }

    const journals = await res.json();

    if (!journals || journals.length === 0) {
        console.log('No journal history found.');
        return [];
    }

    console.log(`Loaded ${journals.length} journals (all pages).`);
    return journals;
}

async function deleteJournal(id_jurnal) {
    console.log(`Deleting journal with ID: ${id_jurnal}`);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .delete()
        .eq('id_jurnal', id_jurnal)
        .select();

    if (error) {
        console.error('Failed to delete journal:', error.message);
        throw error;
    }

    console.log('Journal deleted successfully:', data);
    return data;
}

async function updateJournal(id_jurnal, updates) {
    console.log(`Updating journal ${id_jurnal}:`, updates);

    const { data, error } = await supabase
        .from('daftar_jurnal')
        .update(updates)
        .eq('id_jurnal', id_jurnal)
        .select();

    if (error) {
        if (error.message.includes('duplicate key') || error.code === '23505') {
            const friendlyError = `Update failed: The date and status combination already exists. Use different values.`;
            console.error('Duplicate entry:', friendlyError);
            throw new Error(friendlyError);
        }

        console.error('Failed to update journal:', error.message);
        throw error;
    }

    console.log('Journal updated successfully:', data);
    return data;
}

//upload permission photo to supabase storage, then patch the path to the journal
async function uploadFotoIzin(id_jurnal, id_siswa, fileBuffer, fileName, mimeType) {
    const timestamp = Date.now();
    const fotoPath = `${id_siswa}/${timestamp}_${fileName}`;

    console.log(`[photo upload] Uploading to bucket 'izin': ${fotoPath}`);

    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('izin')
        .upload(fotoPath, fileBuffer, {
            contentType: mimeType,
            upsert: false
        });

    if (uploadError) {
        console.error('[photo upload] Failed to upload to storage:', uploadError.message);
        throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    console.log(`[photo upload] Upload successful: ${uploadData.path}`);

    const { error: patchError } = await supabase
        .from('daftar_jurnal')
        .update({ foto: fotoPath })
        .eq('id_jurnal', id_jurnal);

    if (patchError) {
        console.error('[photo upload] Failed to patch photo to journal:', patchError.message);
        throw new Error(`Photo uploaded but failed to save to journal: ${patchError.message}`);
    }

    console.log(`[photo upload] Photo linked to journal #${id_jurnal}: ${fotoPath}`);
    return { fotoPath };
}

//call RPC to get the alpha dates
async function getAlphaDates(id_siswa) {
    console.log(`Fetching official alpha dates for student ${id_siswa}...`);

    const { data, error } = await supabase.rpc('calculate_alpha_dates_for_student', {
        p_id_siswa: id_siswa
    });

    if (error) {
        console.error('Failed to fetch alpha dates from RPC:', error.message);
        throw error;
    }

    return data.map(item => item.alpha_date);
}

//fetch the national holiday list with the real user token (read-only, doesn't modify anything)
async function getHariLiburNasional(token) {
    console.log('Fetching national holiday list...');

    if (!token) {
        console.warn('[national-holiday] No token — skipping national holiday fetch.');
        return [];
    }

    const baseUrl = `${config.SUPABASE_URL}/rest/v1`;
    const url = `${baseUrl}/daftar_libur_nasional?select=tanggal,nama&order=tanggal.asc`;

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
        console.warn(`[national-holiday] Failed to fetch: ${res.status} - ${text}`);
        return [];
    }

    const data = await res.json();
    console.log(`[national-holiday] Found ${data.length} national holidays.`);
    return data;
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
    updateJournal,
    getAlphaDates,
    getHariLiburNasional
};
