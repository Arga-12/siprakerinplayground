const { login } = require('./src/auth');
const { getJournalHistory } = require('./src/journal');

async function testJournalHistoryHelper() {
    try {
        console.log("Sedang login untuk mendapatkan User ID...");
        const session = await login();
        const user = session.user;
        const token = session.token;

        if (!user) return;

        console.log("---------------------------------------------------");

        // Test Function baru (Page 1)
        console.log("\n--- TEST PAGE 1 (Limit 5) ---");
        const history1 = await getJournalHistory(token, user.id, { page: 1, limit: 5 });
        console.table(history1.map(i => ({ id: i.id_jurnal, tgl: i.tanggal, ket: i.keterangan })));

        // Test Function baru (Page 2)
        console.log("\n--- TEST PAGE 2 (Limit 5) ---");
        try {
            // Coba fetch page 2
            const history2 = await getJournalHistory(token, user.id, { page: 2, limit: 5 });
            if (history2.length > 0) {
                console.table(history2.map(i => ({ id: i.id_jurnal, tgl: i.tanggal, ket: i.keterangan })));
            } else {
                console.log("Page 2 kosong (mungkin data < 5 item).");
            }
        } catch (e) {
            console.log("Page 2 error/empty:", e.message);
        }

    } catch (err) {
        console.error("Test failed:", err);
    }
}

testJournalHistoryHelper();
