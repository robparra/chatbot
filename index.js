import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import db from './utils/db.js';
import User from './models/User.js';
import Response from './models/Response.js';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Sincronizar modelos
db.sync().then(() => {
  console.log('Base de datos y modelos listos');
});

// Middleware para verificar token y extraer userId
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // { id, email }
    next();
  });
}

// Registro de usuario
app.post('/api/register', async (req, res) => {
  const { name, email, password, plan } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, email, password: hashedPassword, plan });
    res.json({ message: 'Usuario creado' });
  } catch (error) {
    res.status(400).json({ error: 'Email ya existe' });
  }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
});

// Obtener respuestas para el usuario autenticado
app.get('/api/responses', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const responses = await Response.findAll({ where: { userId } });
  const data = {};
  responses.forEach(r => (data[r.key] = r.value));
  res.json(data);
});

// Actualizar respuestas para usuario autenticado
app.post('/api/responses', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const entries = Object.entries(req.body);

  for (const [key, value] of entries) {
    await Response.upsert({ key, value, userId });
  }

  res.json({ status: 'ok' });
});

// Webhook Twilio usando respuestas de usuario (por ejemplo, de un usuario admin o fijo)
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : '';

  // Aquí podrías elegir a qué usuario responde el bot (ejemplo: userId=1)
  const userId = 1; // o dinámico según contexto

  const allResponses = await Response.findAll({ where: { userId } });
  const respuestas = {};
  allResponses.forEach(row => {
    respuestas[row.key] = row.value;
  });

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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
