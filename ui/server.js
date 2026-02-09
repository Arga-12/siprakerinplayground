const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { login } = require('../automasi/src/auth');
const { getStudentDetails, submitJournal, getJournalHistory, deleteJournal, updateJournal } = require('../automasi/src/journal');

// Note: Config loading is now handled by automasi/src/config.js which is imported by auth/journal
// But we might want to ensure dotenv is loaded for this file if we access process.env directly here too.
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
    nama_industri: '',
    nama: '',
    nis: '',
    keahlian: ''
};

let sessionToken = null;
let journalHistory = [];

// --- INITIALIZE SERVER ---
async function startServer() {
    try {
        addLog('AUTH', 'Initiating login...');
        const { user, token } = await login();
        sessionToken = token; // Store token for later use
        addLog('AUTH', 'Login successful!');

        addLog('FETCH', 'Fetching student details...');
        // getStudentDetails logs internally to stdout, but we also track progress here
        const details = await getStudentDetails(user);

        // Update Global State
        sessionDefaults = {
            id_siswa: details.id_siswa || '',
            id_kelas: details.id_kelas || '',
            id_industri: details.id_industri || '',
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

        // Fetch Journal History
        addLog('FETCH', 'Loading journal history...');
        try {
            journalHistory = await getJournalHistory(sessionToken, user.id, { page: 1, limit: 50 });
            addLog('SUCCESS', `Loaded ${journalHistory.length} journal entries.`);
        } catch (histErr) {
            addLog('ERROR', `Failed to load journal history: ${histErr.message}`);
        }

        app.listen(port, () => {
            addLog('READY', `UI Server running at http://localhost:${port}`);
        });

    } catch (error) {
        addLog('FATAL', `Initialization failed: ${error.message}`);
        console.error(error);
        // We still listen so the user can see the logs in UI even if init failed
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

app.get('/api/journals', async (req, res) => {
    try {
        // Fetch fresh data from database to ensure real-time updates
        const freshJournals = await getJournalHistory(sessionToken, sessionDefaults.id_siswa, { page: 1, limit: 50 });

        // Separate journals by type and prepare izin data
        const allJournals = freshJournals.map(j => ({
            id: j.id_jurnal,
            tanggal: j.tanggal,
            kegiatan: j.kegiatan,
            keterangan: j.keterangan,
            created_at: j.created_at
        }));

        const izinData = freshJournals
            .filter(j => j.detail_izin)
            .map(j => ({
                id_jurnal: j.id_jurnal,
                tanggal: j.tanggal,
                alasan: j.kegiatan,
                foto: j.detail_izin.foto,
                created_at: j.detail_izin.created_at
            }));

        res.json({
            journals: allJournals,
            permissions: izinData
        });
    } catch (err) {
        console.error('Error fetching journals:', err);
        res.status(500).json({ error: 'Failed to fetch journals' });
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

app.post('/submit', async (req, res) => {
    const { kegiatan, keterangan, tanggal } = req.body;

    addLog('INFO', 'Processing journal submission...');

    if (!kegiatan) {
        addLog('WARN', 'Submission rejected: Missing activity');
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Mohon isi kegiatan!',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    if (!tanggal) {
        addLog('WARN', 'Submission rejected: Missing date');
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Mohon pilih tanggal!',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    // Validate keterangan - only 'hadir' and 'libur' allowed
    const validKeterangan = ['hadir', 'libur'];
    if (!validKeterangan.includes(keterangan)) {
        addLog('WARN', `Submission rejected: Invalid keterangan "${keterangan}"`);
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Keterangan tidak valid! Hanya "hadir" atau "libur" yang diperbolehkan.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    // Validate date range - only allow between 2026-01-05 and 2026-10-01
    const minDate = new Date('2026-01-05');
    const maxDate = new Date('2026-10-01');
    const submittedDate = new Date(tanggal);

    if (submittedDate < minDate) {
        addLog('WARN', `Submission rejected: Date too old (${tanggal})`);
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Tanggal terlalu lama! Jurnal hanya dapat dibuat mulai dari 5 Januari 2026.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    if (submittedDate > maxDate) {
        addLog('WARN', `Submission rejected: Date too far (${tanggal})`);
        return res.render('index', {
            defaults: req.body,
            message: null,
            error: 'Tanggal terlalu jauh! Jurnal hanya dapat dibuat hingga 1 Oktober 2026.',
            logs: systemLogs,
            supabaseUrl: process.env.SUPABASE_URL
        });
    }

    try {
        // We reuse the sessionDefaults for IDs
        const studentIds = {
            id_siswa: sessionDefaults.id_siswa,
            id_kelas: sessionDefaults.id_kelas,
            id_industri: sessionDefaults.id_industri
        };

        if (!studentIds.id_siswa || !studentIds.id_kelas || !studentIds.id_industri) {
            throw new Error("Missing Internal Credentials. Please check .env or server logs.");
        }

        addLog('FETCH', 'Sending data to Supabase...');

        // Call the imported logic with tanggal parameter
        await submitJournal(null, kegiatan, studentIds, keterangan, tanggal);

        addLog('SUCCESS', 'Journal submitted successfully!');
        res.render('index', {
            defaults: sessionDefaults, // Reset form to defaults (but keep IDs)
            message: 'Jurnal berhasil dikirim!',
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

// DELETE journal entry
app.delete('/api/journal/:id', async (req, res) => {
    const { id } = req.params;
    addLog('INFO', `Delete request for journal ID: ${id}`);

    try {
        await deleteJournal(id);
        addLog('SUCCESS', `Journal ${id} deleted successfully`);
        res.json({ success: true, message: 'Jurnal berhasil dihapus' });
    } catch (err) {
        addLog('ERROR', `Delete error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH journal entry
app.patch('/api/journal/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body; // {kegiatan, keterangan, tanggal}

    addLog('INFO', `Update request for journal ID: ${id}`);
    console.log('Update data:', updates); // Debug log

    try {
        const result = await updateJournal(id, updates);
        addLog('SUCCESS', `Journal ${id} updated successfully`);
        res.json({ success: true, message: 'Jurnal berhasil diupdate', data: result });
    } catch (err) {
        addLog('ERROR', `Update error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start the sequence
startServer();
