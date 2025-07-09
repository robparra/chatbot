import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Respuestas dinámicas (inicialmente)
let respuestas = {
  greeting: '👋 ¡Hola! Soy el asistente virtual de tu tienda.\n¿Cómo puedo ayudarte?\n1️⃣ Ver productos destacados\n2️⃣ Consultar disponibilidad\n3️⃣ Formas de pago\n4️⃣ Hablar con atención al cliente',
  option1: 'Aquí están nuestros productos destacados: https://shop.example.com/products',
  option2: 'Todos nuestros productos están disponibles en stock. ¿Quieres que te ayude a elegir?',
  option3: 'Aceptamos tarjetas de crédito, débito y pagos móviles. ¿Quieres más información?',
  option4: 'Puedes contactar con nuestro equipo de atención al cliente enviando un correo a soporte@shop.example.com o llamando al +1234567890.'
};

// ✅ Ruta GET para obtener las respuestas desde el panel
app.get('/api/responses', (req, res) => {
  res.json(respuestas);
});

// ✅ Ruta POST para guardar nuevas respuestas desde el panel
app.post('/api/responses', (req, res) => {
  respuestas = { ...respuestas, ...req.body };
  res.json({ status: 'ok' });
});

// ✅ Webhook de Twilio (usa las respuestas dinámicas)
app.post('/webhook', (req, res) => {
  const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : '';
  let responseMessage = '';

  switch (incomingMsg) {
    case '1':
      responseMessage = respuestas.option1;
      break;
    case '2':
      responseMessage = respuestas.option2;
      break;
    case '3':
      responseMessage = respuestas.option3;
      break;
    case '4':
      responseMessage = respuestas.option4;
      break;
    default:
      responseMessage = respuestas.greeting;
      break;
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Message>${responseMessage}</Message>
  </Response>`;

  res.type('text/xml').send(twiml);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Bot escuchando en http://localhost:${PORT}/webhook`);
});
