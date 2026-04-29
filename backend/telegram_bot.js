const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const FormData = require('form-data');

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

// --- 2. Memoria Persistente (SQLite3) ---
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chatbot.db', (err) => {
    if (err) console.error("Error BD:", err.message);
    else {
        console.log("✅ Conectado a SQLite.");
        db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS users (chat_id TEXT PRIMARY KEY)`);
    }
});

function getHistory(chatId) {
    return new Promise((resolve) => {
        db.all(`SELECT role, content FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 15`, [chatId], (err, rows) => {
            if (err) resolve([]);
            else resolve(rows.reverse());
        });
    });
}
function saveMessage(chatId, role, content) {
    db.run(`INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)`, [chatId, role, content]);
    db.run(`INSERT OR IGNORE INTO users (chat_id) VALUES (?)`, [chatId]);
}

// --- 4. Google Analytics (GA4) ---
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient();

async function getGA4Data() {
    try {
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (!propertyId) return "GA4 pendiente de configurar en .env (falta GA4_PROPERTY_ID)";
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: 'today', endDate: 'today' }],
            metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        });
        if (response.rows && response.rows.length > 0) {
            return `Usuarios activos hoy: ${response.rows[0].metricValues[0].value}, Sesiones: ${response.rows[0].metricValues[1].value}`;
        }
        return "Sin tráfico detectado hoy.";
    } catch (e) {
        return `Error GA4: ${e.message}`;
    }
}

// --- 3. Reportes Proactivos (node-cron) ---
const cron = require('node-cron');
// Todos los días a las 20:00 (8 PM)
cron.schedule('0 20 * * *', async () => {
    console.log('Ejecutando reporte proactivo cron...');
    const ga4Data = await getGA4Data();
    db.all(`SELECT chat_id FROM users`, [], async (err, rows) => {
        if (err || !rows) return;
        for (const row of rows) {
            const chatId = row.chat_id;
            const context = `Eres el COO. Escribe un mensaje corto y proactivo para Marco. Es el corte del día (8:00 PM). Tráfico hoy: ${ga4Data}. Pídele sus gastos para cuadrar el Estado de Resultados. Sé muy ejecutivo y usa métricas de Growth.`;
            try {
                const ai = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o",
                    messages: [{ role: "system", content: context }]
                }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
                const reply = ai.data.choices[0].message.content;
                await bot.sendMessage(chatId, reply);
                saveMessage(chatId, "assistant", reply);
            } catch(e) {
                console.error("Error en cron:", e.message);
            }
        }
    });
});

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
    bot.sendMessage(chatId, `🚀 Listo Marco. Soy tu Socio Operativo y COO para Mayoreo Maestro.\n\nMi objetivo es escalar el negocio, analizar métricas y controlar el flujo de caja.\n\nEstoy conectado y monitoreando. Usa /status para un reporte ejecutivo.`);
});

// Comando /status
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const report = "Reporte Ejecutivo - Mayoreo Maestro:\n- Ebook y Guía de Proveedores: Listos (99 MXN)\n- Automatización: Embudo Activo\n- Tráfico: Monitoreando TikTok Ads y Orgánico\n- Flujo de Caja: En registro";
    
    await bot.sendMessage(chatId, report);
    await generateVoice("Hola Marco. Aquí tienes el estatus ejecutivo. La infraestructura está lista y el embudo activo. Monitoreando tráfico en TikTok y listos para escalar operaciones.", chatId);
});

// Responder a mensajes de texto normales con IA
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    let textToProcess = msg.text;
    let wantsVoice = false;

    if (msg.voice) {
        try {
            await bot.sendMessage(chatId, "⏳ Escuchando...");
            const fileLink = await bot.getFileLink(msg.voice.file_id);
            const audioResponse = await axios({ url: fileLink, method: 'GET', responseType: 'stream' });
            
            const formData = new FormData();
            formData.append('file', audioResponse.data, { filename: 'voice.ogg', contentType: 'audio/ogg' });
            formData.append('model', 'whisper-1');

            const transcriptResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            });
            textToProcess = transcriptResponse.data.text;
            wantsVoice = true; // Responder con voz si envió voz
        } catch (e) {
            console.error("Error transcribiendo:", e.message);
            return bot.sendMessage(chatId, "❌ Error al procesar tu audio.");
        }
    }

    if (textToProcess && !textToProcess.startsWith('/')) {
        try {
            // Contexto del proyecto para la IA
            const projectContext = `
                Rol: Eres el Director de Operaciones (COO) y asistente personal de Marco en el proyecto "Mayoreo Maestro".
                No eres un bot de comandos; eres una inteligencia proactiva, analítica y con iniciativa. 
                Tu tono es profesional, ejecutivo y directo, con la energía de un socio para escalar el negocio.
                
                Objetivos:
                1. Gestión Financiera: Registra gastos/ingresos mentalmente. Pregunta categoría si no es clara.
                2. Control de Proyecto: Guarda info sobre el ebook (99 MXN).
                3. Análisis de Tráfico: Monitorea mayoreomaestro.com. Menciona clics, conversiones y visitas.
                
                Directrices:
                - Proactividad: Advierte sobre métricas o gastos irregulares.
                - Personalidad: Growth Hacker. Usa ROI, CTR, escalabilidad.
                - Brevedad: Datos clave primero, detalles después.
                
                FUNCIONES FINANCIERAS (BALANCE Y ESTADO DE RESULTADOS):
                Si el usuario menciona un movimiento financiero, extrae los datos para alimentar el Balance General y Estado de Resultados.
                SIEMPRE incluye al final de tu respuesta la etiqueta estricta:
                [FINANCE_DATA: {"description": "...", "amount": 0, "type": "Gasto" o "Ingreso", "account_type": "Activo" o "Pasivo" o "Capital" o "Ingreso" o "Gasto_Operativo" o "Costo_Venta", "category": "..."}]
                
                Guía de account_type:
                - Gasto en Ads, salarios, software -> "Gasto_Operativo"
                - Compra de inventario para vender -> "Costo_Venta"
                - Venta del Ebook -> "Ingreso"
                - Compra de equipo -> "Activo"
                - Préstamo recibido -> "Pasivo"
                - Inversión inicial de Marco -> "Capital"
            `;

            // Guardar mensaje de usuario en SQLite
            saveMessage(chatId, "user", textToProcess);

            // Leer historia desde SQLite
            const history = await getHistory(chatId);

            // Obtener datos reales de GA4 para inyectar en contexto
            const ga4Data = await getGA4Data();
            const dynamicContext = projectContext + `\n\nMETRICAS DE TRÁFICO REALES DE HOY: ${ga4Data}`;

            const messages = [
                { role: "system", content: dynamicContext },
                ...history
            ];

            const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o",
                messages: messages
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const replyText = aiResponse.data.choices[0].message.content;
            
            // Guardar respuesta del asistente en SQLite
            saveMessage(chatId, "assistant", replyText);

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
            
            // Generar voz si lo pidió o si envió un audio
            const userAskedForVoice = textToProcess.toLowerCase().includes('voz') || textToProcess.toLowerCase().includes('audio');
            
            if ((wantsVoice || userAskedForVoice) && cleanReply.length < 500) {
                await generateVoice(cleanReply, chatId);
            }

        } catch (error) {
            console.error('Error con OpenAI:', error.message);
            bot.sendMessage(chatId, "Comandante, tuve un problema al procesar tu solicitud, pero sigo aquí atento.");
        }
    }
});
