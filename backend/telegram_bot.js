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

// Memoria de conversación persistente en la sesión
const chatHistories = {};

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
    if (msg.text && !msg.text.startsWith('/')) {
        try {
            // Contexto del proyecto para la IA
            const projectContext = `
                Rol: Eres el Director de Operaciones (COO) y asistente personal de Marco en el proyecto "Mayoreo Maestro".
                No eres un bot de comandos; eres una inteligencia proactiva, analítica y con iniciativa. 
                Tu tono es profesional, ejecutivo y directo, con la energía de un socio para escalar el negocio.
                
                Objetivos:
                1. Gestión Financiera: Registra gastos/ingresos mentalmente. Pregunta categoría si no es clara.
                2. Control de Proyecto: Guarda info sobre el ebook (99 MXN), catálogo de proveedores y embudos.
                3. Análisis de Tráfico: Monitorea mayoreomaestro.com. Menciona clics, conversiones y visitas.
                
                Directrices:
                - Proactividad: Advierte sobre métricas o gastos irregulares.
                - Personalidad: Growth Hacker. Usa ROI, CTR, escalabilidad.
                - Brevedad: Datos clave primero, detalles después.
                - Autonomía: Ante tareas complejas di "Ya estoy en ello".
                
                FUNCIONES FINANCIERAS (INTEGRACIÓN MAKE/SHEETS):
                Si el usuario menciona un gasto o ingreso, debes extraer los datos y SIEMPRE incluir al final de tu respuesta la etiqueta estricta:
                [FINANCE_DATA: {"description": "...", "amount": 0, "type": "Gasto o Ingreso"}]
            `;

            // Configuración de la Memoria a Largo Plazo
            if (!chatHistories[chatId]) {
                chatHistories[chatId] = [];
            }
            chatHistories[chatId].push({ role: "user", content: msg.text });
            if (chatHistories[chatId].length > 15) {
                chatHistories[chatId].shift(); // Mantener contexto limitado para no saturar tokens
            }

            const messages = [
                { role: "system", content: projectContext },
                ...chatHistories[chatId]
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
            
            // Guardar respuesta del asistente en memoria
            chatHistories[chatId].push({ role: "assistant", content: replyText });

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
