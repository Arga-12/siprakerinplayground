const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { login } = require('./src/auth');
const {
    getStudentDetails, submitJournal, getJournalHistory, deleteJournal,
    updateJournal, checkKemarinIzin, getLastIzinFoto, getYesterdayDate,
    uploadFotoIzin, getAlphaDates, getHariLiburNasional
} = require('./src/journal');
const { getRandomActivity } = require('./src/utils');

const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

//multer: file langsung ke memory, gak disimpan di disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file format. Use JPG, PNG, or WebP.'));
        }
    }
});

const app = express();
const port = 3000;

// --- LOGGING SYSTEM ---
const MAX_LOGS = 50;
let systemLogs = [];

function addLog(type, message) {
    const log = {
        time: new Date().toLocaleTimeString('id-ID'),
        type: type,
        message: message
    };
    systemLogs.push(log);
    if (systemLogs.length > MAX_LOGS) {
        systemLogs.shift();
    }
    console.log(`[${log.type}] ${log.message}`);
}
addLog('INFO', 'Server starting...');

// --- GLOBAL STATE (SESSION) ---
let sessionDefaults = {
    id_siswa: '',
    id_kelas: '',
    id_industri: '',
    nama_kelas: '',
    nama_industri: '',
    nama: '',
    nis: '',
    keahlian: ''
};

let sessionToken = null;

// --- INITIALIZE SERVER ---
async function connectWithRetry() {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            addLog('AUTH', attempt === 1 ? 'Initiating login...' : `Retrying login (${attempt}/${MAX_ATTEMPTS})...`);
            return await login();
        } catch (error) {
            if (attempt === MAX_ATTEMPTS) throw error;
            const delay = attempt * 3000;
            addLog('WARN', `Login failed (${error.message}). Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function startServer() {
    try {
        const { user, token } = await connectWithRetry();
        sessionToken = token;
        addLog('AUTH', 'Login successful!');

        addLog('FETCH', 'Fetching student details...');
        const details = await getStudentDetails(user);

        sessionDefaults = {
            id_siswa: details.id_siswa || '',
            id_kelas: details.id_kelas || '',
            id_industri: details.id_industri || '',
            nama_kelas: details.nama_kelas || '',
            nama_industri: details.nama_industri || '',
            nama: details.nama || '',
            nis: details.nis || '',
            keahlian: details.keahlian || ''
        };

        if (sessionDefaults.id_kelas && sessionDefaults.id_industri) {
            addLog('SUCCESS', 'Student details retrieved successfully.');
            addLog('READY', 'System ready with full credentials.');
        } else {
            addLog('WARN', 'System ready but some credentials are MISSING.');
        }

        addLog('READY', `UI Server running at http://localhost:${port}`);
        app.listen(port);

    } catch (error) {
        addLog('FATAL', `Initialization failed: ${error.message}`);
        console.error(error);
        app.listen(port, () => {
            addLog('ERROR', 'Server running in error state.');
        });
    }
}

// --- MIDDLEWARE & ROUTES ---
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/api/logs', (req, res) => res.json(systemLogs));

app.get('/api/calendar', async (req, res) => {
    try {
        addLog('FETCH', 'Preparing calendar statistics data...');

        const [journals, liburNasional] = await Promise.all([
            getJournalHistory(sessionToken, sessionDefaults.id_siswa).catch(() => []),
            getHariLiburNasional(sessionToken)
        ]);

        let alphaDates = [];
        try {
            alphaDates = await getAlphaDates(sessionDefaults.id_siswa);
        } catch (e) {
            addLog('WARN', `Failed to fetch alpha dates: ${e.message}`);
        }

        const statuses = {};

        journals.forEach(j => {
            if (['hadir', 'izin', 'libur'].includes(j.keterangan)) {
                statuses[j.tanggal] = j.keterangan;
            }
        });

        alphaDates.forEach(d => {
            if (!statuses[d]) statuses[d] = 'alfa';
        });

        const liburNasionalMap = {};
        liburNasional.forEach(item => {
            if (!statuses[item.tanggal]) statuses[item.tanggal] = 'libur-nasional';
            liburNasionalMap[item.tanggal] = item.nama;
        });

        addLog('SUCCESS', `Calendar data ready: ${journals.length} journals, ${alphaDates.length} alpha, ${liburNasional.length} national holidays.`);

        res.json({ statuses, liburNasionalMap });
    } catch (err) {
        addLog('ERROR', `Calendar error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
});

//ambil SEMUA jurnal — client handle paginasi (10 per page)
app.get('/api/journals', async (req, res) => {
    try {
        const freshJournals = await getJournalHistory(sessionToken, sessionDefaults.id_siswa);

        const allJournals = freshJournals.map(j => ({
            id: j.id_jurnal,
            tanggal: j.tanggal,
            kegiatan: j.kegiatan,
            keterangan: j.keterangan,
            foto: j.foto || null,
            created_at: j.created_at
        }));

        res.json({
            journals: allJournals
        });
    } catch (err) {
        console.error('Error fetching journals:', err);
        res.status(500).json({ error: 'Failed to fetch journals' });
    }
});

//cek apakah kemarin izin + ada foto atau enggak
app.get('/api/check-kemarin-izin', async (req, res) => {
    try {
        const tanggal = req.query.tanggal || new Date().toISOString().split('T')[0];
        const kemarin = getYesterdayDate(tanggal);

        const isKemarinIzin = await checkKemarinIzin(sessionDefaults.id_siswa, tanggal);

        let fotoKemarin = null;
        if (isKemarinIzin) {
            fotoKemarin = await getLastIzinFoto(sessionDefaults.id_siswa, tanggal);
        }

        res.json({
            tanggal_dicek: kemarin,
            tanggal_submit: tanggal,
            is_kemarin_izin: isKemarinIzin,
            izin_lanjutan_tersedia: isKemarinIzin,
            foto_kemarin_ada: !!fotoKemarin,
            foto_kemarin_path: fotoKemarin || null
        });
    } catch (err) {
        addLog('ERROR', `check-kemarin-izin error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.render('index', {
        defaults: sessionDefaults,
        message: null,
        error: null,
        logs: systemLogs,
        supabaseUrl: process.env.SUPABASE_URL
    });
});

//submit jurnal baru via form multipart
app.post('/', upload.single('foto_izin'), async (req, res) => {
    const { kegiatan, keterangan, tanggal } = req.body;

    addLog('INFO', 'Processing journal submission...');

    if (!kegiatan) {
        addLog('WARN', 'Submission rejected: Missing activity');
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Please fill in the activity!',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    if (!tanggal) {
        addLog('WARN', 'Submission rejected: Missing date');
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Please select a date!',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    const validKeterangan = ['hadir', 'libur', 'izin'];
    if (!validKeterangan.includes(keterangan)) {
        addLog('WARN', 'Submission rejected: Invalid status. Only "hadir", "libur", or "izin" are allowed.');
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Invalid status! Only "hadir", "libur", or "izin" are allowed.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    const minDate = new Date('2026-01-05');
    const maxDate = new Date('2026-10-01');
    const submittedDate = new Date(tanggal);

    if (submittedDate < minDate) {
        addLog('WARN', `Submission rejected: Date too old (${tanggal})`);
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Date too old! Journals can only be created starting from January 5, 2026.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    if (submittedDate > maxDate) {
        addLog('WARN', `Submission rejected: Date too far (${tanggal})`);
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Date too far ahead! Journals can only be created until October 1, 2026.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    try {
        const studentIds = {
            id_siswa: sessionDefaults.id_siswa,
            id_kelas: sessionDefaults.id_kelas,
            id_industri: sessionDefaults.id_industri
        };

        if (!studentIds.id_siswa || !studentIds.id_kelas || !studentIds.id_industri) {
            throw new Error("Missing Internal Credentials. Please check .env or server logs.");
        }

        addLog('FETCH', 'Sending data to Supabase...');

        let izinLanjutan = false;
        if (keterangan === 'izin') {
            izinLanjutan = await checkKemarinIzin(sessionDefaults.id_siswa, tanggal);
            addLog('INFO', `Extended permission: ${izinLanjutan ? 'ACTIVE (yesterday was permission, photo reused)' : 'inactive (new photo upload required)'}`);
        }

        const submittedData = await submitJournal(null, kegiatan, studentIds, keterangan, tanggal, izinLanjutan);

        if (keterangan === 'izin' && req.file && submittedData && submittedData[0]) {
            const newJurnalId = submittedData[0].id_jurnal;
            addLog('FETCH', `Uploading permission letter to storage (${req.file.originalname})...`);
            try {
                const { fotoPath } = await uploadFotoIzin(
                    newJurnalId,
                    sessionDefaults.id_siswa,
                    req.file.buffer,
                    req.file.originalname,
                    req.file.mimetype
                );
                addLog('SUCCESS', `Permission letter uploaded successfully: ${fotoPath}`);
            } catch (uploadErr) {
                addLog('WARN', `Journal saved but photo upload failed: ${uploadErr.message}`);
            }
        } else if (keterangan === 'izin' && !req.file && !izinLanjutan) {
            addLog('INFO', 'Permission saved without photo (no file uploaded).');
        }

        addLog('SUCCESS', 'Journal submitted successfully!');
        res.render('index', {
            defaults: sessionDefaults,
            message: 'Journal submitted successfully!',
            error: null,
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });

    } catch (err) {
        addLog('ERROR', `Submit error: ${err.message}`);
        res.render('index', {
            defaults: sessionDefaults,
            message: null,
            error: err.message,
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }
});

//hapus jurnal
app.delete('/api/journal/:id', async (req, res) => {
    const { id } = req.params;
    addLog('INFO', `Delete request for journal ID: ${id}`);

    try {
        await deleteJournal(id);
        addLog('SUCCESS', `Journal ${id} deleted successfully`);
        res.json({ success: true, message: 'Journal deleted successfully' });
    } catch (err) {
        addLog('ERROR', `Delete error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

//update jurnal
app.patch('/api/journal/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    addLog('INFO', `Update request for journal ID: ${id}`);

    try {
        const result = await updateJournal(id, updates);
        addLog('SUCCESS', `Journal ${id} updated successfully`);
        res.json({ success: true, message: 'Journal updated successfully', data: result });
    } catch (err) {
        addLog('ERROR', `Update error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

//auto-fill semua tanggal alpha pake data dari RPC
app.post('/api/auto-fill', async (req, res) => {
    try {
        addLog('INFO', 'Requesting official alpha attendance data from central server...');

        const missingDates = await getAlphaDates(sessionDefaults.id_siswa);

        if (!missingDates || missingDates.length === 0) {
            addLog('SUCCESS', 'No missing absences, everything is clear!');
            return res.json({ success: true, message: 'All absences are already filled, nothing is missing!' });
        }

        addLog('INFO', `Found ${missingDates.length} official alpha days. Starting auto-fill...`);

        const studentIds = {
            id_siswa: sessionDefaults.id_siswa,
            id_kelas: sessionDefaults.id_kelas,
            id_industri: sessionDefaults.id_industri
        };

        let filledCount = 0;

        for (const dateStr of missingDates) {
            const keterangan = 'hadir';
            const activity = getRandomActivity();

            try {
                await submitJournal(sessionToken, activity, studentIds, keterangan, dateStr, false);
                filledCount++;
                addLog('SUCCESS', `Auto-fill: ${dateStr} -> ${keterangan} (${activity})`);

                //500ms delay to avoid the rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                addLog('ERROR', `Auto-fill failed for date ${dateStr}: ${err.message}`);
            }
        }

        res.json({
            success: true,
            message: `Done! Successfully filled ${filledCount} missing absences based on central data.`
        });

    } catch (error) {
        addLog('FATAL', `Auto-fill error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

startServer();
