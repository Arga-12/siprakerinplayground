
const cron = require('node-cron');
const { login } = require('./src/auth');
const { getStudentDetails, submitJournal } = require('./src/journal');
const { getRandomActivity, getRandomDelay } = require('./src/utils');

async function runTask() {
    console.log('Starting daily journal automation task...');

    // 1. Random Delay
    const delay = getRandomDelay();
    console.log(`Waiting for ${delay / 1000} seconds before execution...`);

    // await new Promise(resolve => setTimeout(resolve, delay));
    console.log('Skipping delay for testing...');

    try {
        // 2. Login
        const { user } = await login();
        // Note: supabase client maintains the session in memory for subsequent calls in this process

        // 3. Get Details
        const studentIds = await getStudentDetails(user);

        // 4. Generate Activity
        const activity = getRandomActivity();

        // 5. Submit
        await submitJournal(null, activity, studentIds);

    } catch (error) {
        console.error('Task failed:', error);
    }
}

// Schedule: 16:00, Monday to Friday
// CRON Syntax: Minute Hour DayMonth Month DayWeek
console.log('Scheduler started. Waiting for 16:00 M-F...');
cron.schedule('0 16 * * 1-5', () => {
    runTask();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

// For testing purposes (uncomment to run immediately on start)
runTask();
