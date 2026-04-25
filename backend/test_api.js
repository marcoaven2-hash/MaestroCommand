const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnections() {
    console.log('--- Testing SCALE V2 API Connections ---');

    // 1. Test OpenAI
    try {
        const openai = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Say hello." }],
            max_tokens: 5
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
        });
        console.log('✅ OpenAI: SUCCESS');
    } catch (e) {
        console.log('❌ OpenAI: FAILED', e.response ? e.response.data : e.message);
    }

    // 2. Test ElevenLabs
    try {
        const eleven = await axios.get('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
        });
        console.log('✅ ElevenLabs: SUCCESS');
    } catch (e) {
        console.log('❌ ElevenLabs: FAILED', e.response ? e.response.data : e.message);
    }

    // 3. Test Make (Check if key exists)
    if (process.env.MAKE_API_KEY) {
        console.log('✅ Make.com: KEY REGISTERED');
    } else {
        console.log('❌ Make.com: KEY MISSING');
    }
}

testConnections();
