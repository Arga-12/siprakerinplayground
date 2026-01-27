
const activities = [
    "test",
    "makan"
];

function getRandomActivity() {
    const randomIndex = Math.floor(Math.random() * activities.length);
    return activities[randomIndex];
}

function getRandomDelay(maxMinutes = 15) {
    // Return delay in milliseconds
    const minutes = Math.floor(Math.random() * maxMinutes);
    const seconds = Math.floor(Math.random() * 60);
    return (minutes * 60 + seconds) * 1000;
}

module.exports = {
    getRandomActivity,
    getRandomDelay,
    activities // Exporting list if needed for UI later
};
