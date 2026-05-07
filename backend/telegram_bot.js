const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
require('dotenv').config();
const moment = require('moment-timezone');

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

// --- Auto-Ping (Marcapasos 24/7) ---
// El bot se "visita" a sí mismo cada 14 minutos para que Render nunca lo duerma
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
setInterval(() => {
    axios.get(RENDER_URL)
        .then(() => console.log(`[Auto-Ping] Latido exitoso. Servidor despierto.`))
        .catch((err) => console.error(`[Auto-Ping] Error:`, err.message));
}, 14 * 60 * 1000);

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

console.log('🤖 Maestro Command Bot está en línea...');

// --- 2. Memoria Persistente (JSON) ---
const memoryFile = './chatbot_memory.json';
if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, JSON.stringify({ messages: {}, users: [] }));
}

function getMemory() {
    try {
        return JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    } catch (e) {
        return { messages: {}, users: [] };
    }
}

function saveMemory(data) {
    fs.writeFileSync(memoryFile, JSON.stringify(data, null, 2));
}

async function getHistory(chatId) {
    const mem = getMemory();
    return mem.messages[chatId] || [];
}

function saveMessage(chatId, role, content) {
    const mem = getMemory();
    if (!mem.users.includes(chatId)) mem.users.push(chatId);
    if (!mem.messages[chatId]) mem.messages[chatId] = [];
    mem.messages[chatId].push({ role, content });
    if (mem.messages[chatId].length > 15) mem.messages[chatId].shift();
    saveMemory(mem);
}

function getAllUsers() {
    return getMemory().users;
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

// Todos los días a las 11:00 AM (Zona horaria de Marco: America/Tijuana o similar -07:00)
cron.schedule('0 11 * * *', async () => {
    console.log('Ejecutando reporte proactivo matutino (11 AM)...');
    const ga4Data = await getGA4Data();
    const users = getAllUsers();
    
    for (const chatId of users) {
        const morningContext = `
            Eres el COO de Mayoreo Maestro. Es la reunión matutina de las 11:00 AM con Marco.
            Objetivo: Registrar gastos del día anterior y planificar el flujo de caja de hoy.
            Datos de tráfico de ayer/hoy: ${ga4Data}.
            
            Instrucciones:
            1. Saluda de forma ejecutiva y proactiva.
            2. Menciona brevemente el tráfico si es relevante.
            3. Pídele directamente que registre los gastos pendientes para mantener el Estado de Resultados actualizado.
            4. Sé breve, inteligente y enfocado en Growth.
            
            IMPORTANTE: Tu respuesta será convertida a voz realista, así que escribe de forma natural pero profesional.
        `;
        
        try {
            const ai = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o",
                messages: [{ role: "system", content: morningContext }]
            }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
            
            const reply = ai.data.choices[0].message.content;
            
            // Limpiar etiqueta financiera para el usuario
            const cleanReply = reply.replace(/\[FINANCE_DATA: .*\]/g, '').trim();
            
            // Enviar texto
            await bot.sendMessage(chatId, cleanReply);
            saveMessage(chatId, "assistant", reply);
            
            // Enviar VOZ (ElevenLabs)
            await generateVoice(cleanReply, chatId);
            
            console.log(`Reporte de 11 AM enviado a ${chatId}`);
        } catch(e) {
            console.error("Error en cron matutino:", e.message);
        }
    }
}, {
    scheduled: true,
    timezone: "America/Tijuana"
});

// Función para generar voz con ElevenLabs
async function generateVoice(text, chatId) {
    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB`, // Voz de Adam (ID Corregido)
            {
                text: text,
                model_id: "eleven_turbo_v2_5", // Modelo más rápido y eficiente
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

// Comando para probar el reporte matutino manualmente
bot.onText(/\/test_morning/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "⏳ Generando reporte matutino de prueba...");
    
    const ga4Data = await getGA4Data();
    const morningContext = `
        Eres el COO de Mayoreo Maestro. Esta es una prueba del reporte matutino de las 11:00 AM.
        Objetivo: Registrar gastos y planificar flujo de caja.
        Datos de tráfico: ${ga4Data}.
        Sé proactivo, ejecutivo y usa la voz de Adam.
    `;
    
    try {
        const ai = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [{ role: "system", content: morningContext }]
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
        
        const reply = ai.data.choices[0].message.content;
        const cleanReply = reply.replace(/\[FINANCE_DATA: .*\]/g, '').trim();
        
        await bot.sendMessage(chatId, cleanReply);
        saveMessage(chatId, "assistant", reply);
        await generateVoice(cleanReply, chatId);
    } catch (e) {
        console.error("Error en test_morning:", e.message);
        bot.sendMessage(chatId, "❌ Hubo un error al generar el reporte de prueba.");
    }
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
            
            const filePath = `./voice_${chatId}.ogg`;
            const writer = fs.createWriteStream(filePath);
            audioResponse.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath), { filename: 'voice.ogg', contentType: 'audio/ogg' });
            formData.append('model', 'whisper-1');

            const transcriptResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            });
            textToProcess = transcriptResponse.data.text;
            wantsVoice = true; // Responder con voz si envió voz
            
            // Limpiar archivo temporal
            fs.unlinkSync(filePath);
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
                
                Capacidades Técnicas (IMPORTANTE):
                - SÍ puedes escuchar y procesar notas de voz. 
                - Tu respuesta SIEMPRE será enviada en formato de audio (ElevenLabs) además del texto, para mantener una comunicación ejecutiva fluida.
                - Si el usuario envía un audio, transcríbelo y respóndele con tu propia voz.
                
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
            
            // Generar voz por defecto (ElevenLabs habilitado)
            if (cleanReply.length < 600) { 
                await generateVoice(cleanReply, chatId);
            }

        } catch (error) {
            console.error('Error con OpenAI:', error.message);
            bot.sendMessage(chatId, "Comandante, tuve un problema al procesar tu solicitud, pero sigo aquí atento.");
        }
    }
});
