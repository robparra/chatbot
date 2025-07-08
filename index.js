import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;


const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Endpoint webhook para recibir mensajes de Twilio
app.post('/webhook', (req, res) => {
  const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : '';
  let responseMessage = '';

  switch(incomingMsg) {
    case '1':
      responseMessage = 'Aquí están nuestros productos destacados: https://shop.example.com/products';
      break;
    case '2':
      responseMessage = 'Todos nuestros productos están disponibles en stock. ¿Quieres que te ayude a elegir?';
      break;
    case '3':
      responseMessage = 'Aceptamos tarjetas de crédito, débito y pagos móviles. ¿Quieres más información?';
      break;
    case '4':
      responseMessage = 'Puedes contactar con nuestro equipo de atención al cliente enviando un correo a soporte@shop.example.com o llamando al +1234567890.';
      break;
    default:
      responseMessage = '👋 ¡Hola! Soy el asistente virtual de tu tienda.\n¿Cómo puedo ayudarte?\n1️⃣ Ver productos destacados\n2️⃣ Consultar disponibilidad\n3️⃣ Formas de pago\n4️⃣ Hablar con atención al cliente';

      break;
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Message>${responseMessage}</Message>
  </Response>`;

  res.type('text/xml').send(twiml);
});

app.listen(PORT, () => {
  console.log(`Bot escuchando en http://localhost:${PORT}/webhook`);
});