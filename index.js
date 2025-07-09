import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import db from './utils/db.js';
import User from './models/User.js';
import Response from './models/Response.js';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();  // <-- Aquí debe estar primero

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api/users', userRoutes);  // <-- Aquí ya puedes usar app

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'un-secreto-muy-seguro';

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Inicializa la base de datos
db.sync().then(async () => {
  console.log('Base de datos lista');
  // Opcional: crear respuestas por defecto si no existen
});

// Registro de usuario
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, plan = 'basic' } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email y password requeridos' });

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: 'Usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ email, password: hashedPassword, plan });

    res.json({ message: 'Usuario creado', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno' });
  }
});


// Login de usuario
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email y password requeridos' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: 'Contraseña incorrecta' });

    // ✅ Incluye el campo "plan" en el token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        plan: user.plan  // <<--- Aquí va el plan
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno' });
  }
});



// Middleware para validar JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No autorizado' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No autorizado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user; // contiene userId, email y plan
    next();
  });
}

// Ruta protegida por plan (solo Pro o Premium)
app.get('/api/pro-feature', authenticateToken, (req, res) => {
  if (req.user.plan !== 'pro' && req.user.plan !== 'premium') {
    return res.status(403).json({ message: 'Este recurso requiere el plan Pro o Premium' });
  }

  res.json({ message: 'Bienvenido a la funcionalidad Pro/Premium' });
});

// Rutas protegidas que usan authenticateToken

// Obtener respuestas (solo usuario autenticado)
app.get('/api/responses', authenticateToken, async (req, res) => {
  const rows = await Response.findAll();
  const data = {};
  rows.forEach((row) => {
    data[row.key] = row.value;
  });
  res.json(data);
});

// Actualizar respuestas (solo usuario autenticado)
app.post('/api/responses', authenticateToken, async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await Response.upsert({ key, value });
  }
  res.json({ status: 'ok' });
});

// Webhook de Twilio (puede ser público o autenticado según prefieras)
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body ? req.body.Body.trim().toLowerCase() : '';

  const allResponses = await Response.findAll();
  const respuestas = {};
  allResponses.forEach((row) => {
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
