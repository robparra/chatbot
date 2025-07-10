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
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'un-secreto-muy-seguro';

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Asegura que la carpeta de uploads exista
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `catalog_${Date.now()}${ext}`;
    cb(null, filename);
  }
});
const upload = multer({ storage });

// Ruta para subir el catálogo
app.post('/api/upload-catalog', authenticateToken, upload.single('catalog'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ningún archivo' });
  }

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ catalogUrl: url });
});

// Sirve los archivos estáticos subidos
app.use('/uploads', express.static('uploads'));

// Middleware para validar JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No autorizado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user; // { userId, email, plan }
    next();
  });
}

// Middleware para verificar el plan del usuario
function authorizePlan(allowedPlans) {
  return (req, res, next) => {
    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({ message: 'Este recurso no está incluido en tu plan' });
    }
    next();
  };
}

// Rutas de usuario (opcional, si quieres modularizar)
app.use('/api/users', userRoutes);

// Inicializa la base de datos
db.sync().then(async () => {
  console.log('Base de datos lista');

  // Crear respuestas por defecto si no existen
  const keys = ['greeting', 'option1', 'option2', 'option3', 'option4'];
  const defaults = {
    greeting: 'Hola! Bienvenido a nuestro chatbot',
    option1: 'Información sobre productos',
    option2: 'Soporte técnico',
    option3: 'Hablar con un asesor',
    option4: 'Ver promociones'
  };

  for (const key of keys) {
    const existing = await Response.findOne({ where: { key } });
    if (!existing) {
      await Response.create({ key, value: defaults[key] });
    }
  }
});

db.authenticate()
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch((err) => console.error('❌ Error al conectar a PostgreSQL:', err));



// 🔐 Registro de usuario
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, plan = 'basic' } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y password requeridos' });

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, plan });

    res.json({ message: 'Usuario creado', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: 'Error interno' });
  }
});

// 🔐 Login de usuario
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y password requeridos' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { userId: user.id, email: user.email, plan: user.plan },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error interno' });
  }
});

// ✅ Rutas protegidas
app.get('/api/responses', authenticateToken, async (req, res) => {
  const rows = await Response.findAll();
  const data = {};
  rows.forEach((row) => {
    data[row.key] = row.value;
  });
  res.json(data);
});

app.post('/api/responses', authenticateToken, async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await Response.upsert({ key, value });
  }
  res.json({ status: 'ok' });
});

// ✅ Ruta solo para usuarios Pro o Premium
app.get('/api/pro-feature', authenticateToken, authorizePlan(['pro', 'premium']), (req, res) => {
  res.json({ message: 'Bienvenido a la funcionalidad Pro/Premium' });
});

// ✅ Webhook (público o protegido, tú decides)
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim().toLowerCase() || '';

  const rows = await Response.findAll();
  const respuestas = {};
  rows.forEach((row) => {
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
    case 'catalogo':
    case 'catálogo':
      responseMessage = respuestas.catalog_url || 'No se ha cargado ningún catálogo aún.';
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


// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
