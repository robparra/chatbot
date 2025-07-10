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
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'un-secreto-muy-seguro';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Crear carpeta uploads si no existe
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configuración multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `catalog_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Subir catálogo
app.post('/api/upload-catalog', authenticateToken, upload.single('catalog'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo' });

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ catalogUrl: url });
});

app.use('/uploads', express.static('uploads'));

// Middleware autenticación JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No autorizado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Middleware verificación de plan
function authorizePlan(allowedPlans) {
  return (req, res, next) => {
    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({ message: 'Este recurso no está incluido en tu plan' });
    }
    next();
  };
}

app.use('/api/users', userRoutes);

// Inicializar base de datos
db.sync().then(async () => {
  console.log('Base de datos lista');
}).catch(console.error);

db.authenticate()
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch((err) => console.error('❌ Error al conectar a PostgreSQL:', err));

// Registro
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, plan = 'basic', phone } = req.body;
    if (!email || !password || !phone) {
      return res.status(400).json({ message: 'Email, teléfono y password requeridos' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, phone, password: hashedPassword, plan });

    res.json({ message: 'Usuario creado', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: 'Error interno' });
  }
});

// Login
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

// Obtener respuestas del usuario
app.get('/api/responses', authenticateToken, async (req, res) => {
  const rows = await Response.findAll({ where: { userId: req.user.userId } });
  const data = {};
  rows.forEach((row) => {
    data[row.key] = row.value;
  });
  res.json(data);
});

// Guardar respuestas del usuario
app.post('/api/responses', authenticateToken, async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await Response.upsert({ key, value, userId: req.user.userId });
  }
  res.json({ status: 'ok' });
});

// Ruta solo para usuarios Pro o Premium
app.get('/api/pro-feature', authenticateToken, authorizePlan(['pro', 'premium']), (req, res) => {
  res.json({ message: 'Bienvenido a la funcionalidad Pro/Premium' });
});

// Webhook
app.post('/webhook', async (req, res) => {
  console.log('📲 Body recibido:', req.body);

  const incomingMsg = req.body.Body?.trim().toLowerCase() || '';
  const phone = req.body.From?.replace('whatsapp:', '').trim(); // normalizar

  try {
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.type('text/xml').send(`<Response><Message>Usuario no encontrado.</Message></Response>`);
    }

    const rows = await Response.findAll({ where: { userId: user.id } });
    const respuestas = {};
    rows.forEach((row) => {
      respuestas[row.key] = row.value;
    });

    let responseMessage = '';

    if ((user.plan === 'pro' || user.plan === 'premium') && respuestas.custom_prompt) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: respuestas.custom_prompt },
            { role: 'user', content: incomingMsg }
          ]
        });
        responseMessage = completion.choices[0].message.content.trim();
      } catch (err) {
        console.error('❌ Error con OpenAI:', err.response?.data || err.message);
        responseMessage = 'Ocurrió un error con la IA personalizada.';
      }
    } else {
      switch (incomingMsg) {
        case '1': responseMessage = respuestas.option1 || ''; break;
        case '2': responseMessage = respuestas.option2 || ''; break;
        case '3': responseMessage = respuestas.option3 || ''; break;
        case '4': responseMessage = respuestas.option4 || ''; break;
        case 'catalogo':
        case 'catálogo': responseMessage = respuestas.catalog_url || 'No hay catálogo disponible.'; break;
        default: responseMessage = respuestas.greeting || '¡Hola!';
      }
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Message>${responseMessage}</Message>
    </Response>`;

    res.type('text/xml').send(twiml);

  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.type('text/xml').send(`<Response><Message>Error inesperado.</Message></Response>`);
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
