const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Marcapasos: Endpoint de salud para que Render no se duerma
app.get('/', (req, res) => {
    res.send('🤖 Maestro Command Bot está despierto y vigilando.');
});

app.listen(port, () => {
    console.log(`📡 Servidor de salud escuchando en el puerto ${port}`);
});

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

console.log('🤖 Maestro Command Bot está en línea...');

// Función para generar voz con ElevenLabs
async function generateVoice(text, chatId) {
    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal`, // Voz de Eric
            {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            {
                headers: {
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        const fileName = `voice_${chatId}.mp3`;
        fs.writeFileSync(fileName, response.data);
        await bot.sendVoice(chatId, fileName);
        fs.unlinkSync(fileName); // Borrar después de enviar
    } catch (error) {
        console.error('Error en ElevenLabs:', error.message);
        bot.sendMessage(chatId, "⚠️ No pude generar la nota de voz, pero aquí tienes el texto.");
    }
}

// Comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🚀 Bienvenido, Comandante. Soy el sistema SCALE V2.\n\nEstoy listo para darte reportes de ventas y actualizaciones. \n\nUsa /status para ver el progreso actual.`);
});

// Comando /status
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const report = "Reporte de hoy:\n- Catálogo: Terminado\n- Landing Page: Lista\n- TikTok Ads: Pendiente de verificación\n- Ventas: $0 (Lanzamiento mañana)";
    
    await bot.sendMessage(chatId, report);
    await generateVoice("Hola Comandante. Aquí tienes el reporte: El catálogo y la página de ventas están listos al cien por ciento. Solo estamos esperando la aprobación de TikTok para encender la máquina de pauta.", chatId);
});

// Responder a mensajes de texto normales con IA
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.text && !msg.text.startsWith('/')) {
        try {
            // Contexto del proyecto para la IA
            const projectContext = `
                Eres el asistente ejecutivo del sistema SCALE V2.
                El usuario es el Comandante Marco.
                
                FUNCIONES FINANCIERAS:
                Si el usuario menciona un gasto o un ingreso (ej: "gasté 200 en ads" o "vendí un catálogo"), 
                debes identificar:
                1. Descripción: Qué se compró o vendió.
                2. Monto: El número (solo el valor numérico).
                3. Tipo: "Gasto" o "Ingreso".
                
                Si detectas esto, responde confirmando el registro y añade la etiqueta [FINANCE_DATA: {"description": "...", "amount": 0, "type": "..."}] al final de tu respuesta.
            `;

            const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o",
                messages: [
                    { role: "system", content: projectContext },
                    { role: "user", content: msg.text }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const replyText = aiResponse.data.choices[0].message.content;
            
            // Procesar datos financieros si existen
            const financeMatch = replyText.match(/\[FINANCE_DATA: (.*)\]/);
            if (financeMatch) {
                try {
                    const financeData = JSON.parse(financeMatch[1]);
                    await axios.post('https://hook.us2.make.com/ueqqi1sngmr7izijrs47xq2xtitanyyr', financeData);
                    console.log('✅ Finanzas registradas en Google Sheets');
                } catch (e) {
                    console.error('Error al enviar a Make:', e.message);
                }
            }

            // Responder con texto (limpiando la etiqueta de la respuesta final)
            const cleanReply = replyText.replace(/\[FINANCE_DATA: .*\]/, '').trim();
            await bot.sendMessage(chatId, cleanReply);
            
            // SOLO generar voz si el usuario lo pide expresamente
            const wantsVoice = msg.text.toLowerCase().includes('voz') || msg.text.toLowerCase().includes('audio');
            
            if (wantsVoice && cleanReply.length < 500) {
                await generateVoice(cleanReply, chatId);
            }

        } catch (error) {
            console.error('Error con OpenAI:', error.message);
            bot.sendMessage(chatId, "Comandante, tuve un problema al procesar tu solicitud, pero sigo aquí atento.");
        }
    }
});
