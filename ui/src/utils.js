const activities = [
    "hadir",
    "hаdir",
    "𝚑𝚊𝚍𝚒𝚛",
    "𝐡adir"
];

function getRandomActivity() {
    return activities[Math.floor(Math.random() * activities.length)];
}

function getRandomDelay(maxMinutes = 15) {
    const minutes = Math.floor(Math.random() * maxMinutes);
    const seconds = Math.floor(Math.random() * 60);
    return (minutes * 60 + seconds) * 1000;
}

module.exports = {
    getRandomActivity,
    getRandomDelay,
    activities
};
