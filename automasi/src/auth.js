
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

async function login() {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: config.USER_EMAIL,
            password: config.USER_PASSWORD,
        });

        if (error) {
            throw error;
        }

        // Return both token and user object (which contains the UUID)
        return {
            token: data.session.access_token,
            user: data.user
        };
    } catch (error) {
        console.error('Login gagal:', error.message);
        throw error;
    }
}

module.exports = { login, supabase };