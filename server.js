// server.js

// --- Importaciones ---
const express = require("express");
const fetch = require("node-fetch");

// --- Inicialización de la App Express ---
const app = express();
app.use(express.json()); // Middleware para parsear el cuerpo de las peticiones como JSON

// --- Variables de Entorno ---
const MESSENGER_ACCESS_TOKEN = process.env.MESSENGER_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- Ruta Principal (para verificar que el servidor está funcionando) ---
app.get("/", (req, res) => {
  res.send("¡El servidor del bot de Instagram está en línea!");
});

// --- RUTA DE VERIFICACIÓN DEL WEBHOOK (GET) ---
app.get("/webhook", (req, res) => {
  console.log("Recibida petición de verificación de webhook...");

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("¡Webhook verificado con éxito!");
      res.status(200).send(challenge);
    } else {
      console.log("Fallo en la verificación. Tokens no coinciden.");
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// --- RUTA DE EVENTOS DEL WEBHOOK (POST) ---
app.post("/webhook", async (req, res) => {
  const body = req.body;
  console.log("Recibido evento de webhook:", JSON.stringify(body, null, 2));

  // CORRECCIÓN: Verificamos que el objeto sea "instagram" o "page"
  if (body.object === "instagram" || body.object === "page") {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        if (event.message && event.message.text) {
          const senderId = event.sender.id;
          const messageText = event.message.text;
          console.log(`Mensaje recibido de ${senderId}: "${messageText}"`);

          try {
            const geminiResponse = await getGeminiResponse(messageText);
            console.log(`Respuesta de Gemini: "${geminiResponse}"`);
            await sendInstagramMessage(senderId, geminiResponse);
            console.log("Respuesta enviada a Instagram con éxito.");
          } catch (error) {
            console.error("Error procesando el mensaje:", error);
          }
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Si el evento no es de los esperados, lo ignoramos
    res.sendStatus(404);
  }
});

// --- FUNCIÓN PARA OBTENER RESPUESTA DE GEMINI ---
async function getGeminiResponse(prompt) {
  const apiKey = ""; // No se necesita clave en este entorno
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: `Eres un asistente de Instagram. Responde de forma breve y amigable. El usuario dijo: "${prompt}"` }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150,
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Error de API de Gemini: ${response.status}`);
    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error llamando a la API de Gemini:", error);
    return "Ups, algo salió mal. Inténtalo de nuevo.";
  }
}

// --- FUNCIÓN PARA ENVIAR MENSAJES A INSTAGRAM ---
async function sendInstagramMessage(recipientId, text) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text: text },
  };
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${MESSENGER_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
    });
    if (!response.ok) throw new Error(`Error de API de Messenger: ${response.status}`);
    console.log("Mensaje enviado a la API de Messenger.");
  } catch (error) {
    console.error("Error al enviar el mensaje de Instagram:", error);
  }
}

// --- Iniciar el Servidor ---
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Tu app está escuchando en el puerto " + listener.address().port);
});
