const express = require('express');
const multer = require('./upload/multer-config');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
require('dotenv').config();

// Configurazione connessione Postgres
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Inizializzazione del database
async function initializeDatabase() {
  try {
    // Crea tabella encryption_keys
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id SERIAL PRIMARY KEY,
        key_value BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea tabella files
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        relative_path VARCHAR(255),
        encrypted_path VARCHAR(255) NOT NULL,
        encryption_key BYTEA,
        expiration TIMESTAMP,
        email VARCHAR(255),
        group_id VARCHAR(64),
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        key_id INTEGER REFERENCES encryption_keys(id)
      )
    `);

    // Migrazione dei dati: copiare encryption_key in key_id se necessario
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'files' 
          AND column_name = 'encryption_key'
        ) THEN
          -- Crea una nuova chiave di crittografia per i file esistenti
          WITH new_key AS (
            INSERT INTO encryption_keys (key_value)
            SELECT DISTINCT encryption_key 
            FROM files 
            WHERE encryption_key IS NOT NULL
            RETURNING id, key_value
          )
          UPDATE files f
          SET key_id = nk.id
          FROM new_key nk
          WHERE f.encryption_key = nk.key_value;
          
          -- Rimuovi la vecchia colonna encryption_key
          ALTER TABLE files DROP COLUMN IF EXISTS encryption_key;
        END IF;
      END $$;
    `);

    console.log('Database inizializzato con successo');
  } catch (err) {
    console.error('Errore durante l\'inizializzazione del database:', err);
    throw err;
  }
}

let ENCRYPTION_KEY;

// Funzione per ottenere o creare una chiave di crittografia
async function getOrCreateEncryptionKey() {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;
  
  // Cerca una chiave esistente
  const keyResult = await pool.query('SELECT key_value FROM encryption_keys ORDER BY created_at DESC LIMIT 1');
  
  if (keyResult.rows.length > 0) {
    ENCRYPTION_KEY = keyResult.rows[0].key_value;
  } else {
    // Crea una nuova chiave
    ENCRYPTION_KEY = crypto.randomBytes(32);
    await pool.query('INSERT INTO encryption_keys (key_value) VALUES ($1)', [ENCRYPTION_KEY]);
  }
  
  return ENCRYPTION_KEY;
}

const IV_LENGTH = 16;

// Aggiorna le funzioni di crittografia per usare la chiave corretta
async function encryptFile(inputPath, outputPath) {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  output.write(iv);
  input.pipe(cipher).pipe(output);
  return new Promise((resolve) => output.on('finish', resolve));
}

async function decryptFile(inputPath, outputPath, keyValue) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`File not found: ${inputPath}`));
    }

    const input = fs.createReadStream(inputPath);
    input.on('error', (err) => {
      reject(err);
    });

    input.once('readable', () => {
      try {
        const iv = input.read(IV_LENGTH);
        if (!iv || iv.length !== IV_LENGTH) {
          reject(new Error('Invalid encrypted file format'));
          return;
        }

        const decipher = crypto.createDecipheriv('aes-256-cbc', keyValue, iv);
        const output = fs.createWriteStream(outputPath);
        
        output.on('error', (err) => {
          reject(err);
        });

        input.pipe(decipher).pipe(output);
        output.on('finish', resolve);
      } catch (err) {
        reject(err);
      }
    });
  });
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

async function sendDownloadEmail(to, links) {
  const htmlLinks = links.map(l => `<li><a href="${l.link}">${l.originalName}</a></li>`).join('');
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: 'I tuoi file sono pronti per il download',
    html: `<p>Ecco i tuoi file:</p><ul>${htmlLinks}</ul>`
  });
}

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json());


// API routes
app.post('/api/verify-password/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { password } = req.body;
  
  try {
    const result = await pool.query('SELECT password FROM files WHERE group_id = $1 LIMIT 1', [groupId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gruppo non trovato' });
    }
    
    if (result.rows[0].password === password) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false });
    }
  } catch (err) {
    console.error('Errore nella verifica della password:', err);
    res.status(500).json({ message: 'Errore interno del server' });
  }
});

app.get('/api/check-password/:groupId', async (req, res) => {
  const { groupId } = req.params;
  
  try {
    const result = await pool.query('SELECT password FROM files WHERE group_id = $1 LIMIT 1', [groupId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gruppo non trovato' });
    }
    
    res.json({ hasPassword: !!result.rows[0].password });
  } catch (err) {
    console.error('Errore nel controllo della password:', err);
    res.status(500).json({ message: 'Errore interno del server' });
  }
});

// Middleware per verificare la password
async function checkPassword(req, res, next) {
  const { groupId } = req.params;
  // Controlla sia header che query parameter per la password
  const providedPassword = req.headers['x-password'] || req.query.password || null;
  
  try {
    const result = await pool.query('SELECT password FROM files WHERE group_id = $1 LIMIT 1', [groupId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gruppo non trovato' });
    }
    
    // Se il file è protetto da password ma non è stata fornita o non è corretta
    if (result.rows[0].password && result.rows[0].password !== providedPassword) {
      return res.status(401).send('Password non valida');
    }
    
    next();
  } catch (err) {
    console.error('Errore nella verifica della password:', err);
    res.status(500).send('Errore interno del server');
  }
}

// Aggiungi un log per verificare i dati restituiti dall'API
app.get('/api/group/:groupId', checkPassword, async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await pool.query(`
      SELECT f.*, k.key_value 
      FROM files f 
      JOIN encryption_keys k ON f.key_id = k.id 
      WHERE f.group_id = $1
    `, [groupId]);

    if (result.rows.length === 0) {
      console.log('Nessun file trovato per il gruppo:', groupId);
      return res.status(404).json({ message: 'Nessun file trovato per questo link.' });
    }

    const now = new Date();
    const validFiles = result.rows.filter(f => !f.expiration || new Date(f.expiration) > now);

    if (validFiles.length === 0) {
      console.log('Tutti i file per il gruppo sono scaduti:', groupId);
      return res.status(410).json({ message: 'Link scaduto.' });
    }

    console.log('File validi trovati per il gruppo:', validFiles);
    res.json({
      message: 'File disponibili per il download.',
      files: validFiles.map(f => ({
        id: f.id,
        filename: f.filename,
        originalName: f.original_name,
        relativePath: f.relative_path,
        size: fs.existsSync(f.encrypted_path) ? fs.statSync(f.encrypted_path).size : 0
      }))
    });
  } catch (err) {
    console.error('Errore nel recupero dei file:', err);
    res.status(500).json({ message: 'Errore interno del server.' });
  }
});

// Download routes
app.get('/group/:groupId/download/:fileId', checkPassword, async (req, res) => {
  const { groupId, fileId } = req.params;
  try {
    const result = await pool.query(`
      SELECT f.*, k.key_value 
      FROM files f 
      JOIN encryption_keys k ON f.key_id = k.id 
      WHERE f.group_id = $1 AND f.id = $2
    `, [groupId, fileId]);
    
    if (result.rows.length === 0) return res.status(404).send('File non trovato.');
    const file = result.rows[0];
    
    if (file.expiration && new Date(file.expiration) < new Date()) {
      return res.status(410).send('Link scaduto.');
    }
    
    if (!fs.existsSync(file.encrypted_path)) {
      return res.status(404).send('File non trovato sul server.');
    }
    
    const tempPath = file.encrypted_path + '.dec';
    await decryptFile(file.encrypted_path, tempPath, file.key_value);
    
    res.download(tempPath, file.original_name, (err) => {
      // Cleanup temp file in both success and error cases
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      if (err && !res.headersSent) {
        res.status(500).send('Errore durante il download del file.');
      }
    });
  } catch (err) {
    console.error('Errore durante il download:', err);
    if (!res.headersSent) {
      res.status(500).send('Errore durante il download del file.');
    }
  }
});

app.get('/group/:groupId/download-zip', checkPassword, async (req, res) => {
  const { groupId } = req.params;
  const tempFiles = [];
  
  try {
    const result = await pool.query(`
      SELECT f.*, k.key_value 
      FROM files f 
      JOIN encryption_keys k ON f.key_id = k.id 
      WHERE f.group_id = $1
    `, [groupId]);
    
    if (result.rows.length === 0) return res.status(404).send('Nessun file trovato per questo link.');
    const now = new Date();
    const validFiles = result.rows.filter(f => !f.expiration || new Date(f.expiration) > now);
    if (validFiles.length === 0) return res.status(410).send('Link scaduto.');

    // Verify all encrypted files exist before starting
    for (const file of validFiles) {
      if (!fs.existsSync(file.encrypted_path)) {
        return res.status(404).send('Alcuni file non sono più disponibili sul server.');
      }
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="securetransfer_${groupId}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('Errore durante la creazione del zip:', err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).send('Errore durante la creazione del file zip.');
      }
    });
    
    archive.pipe(res);
    
    // Decrypt all files first
    for (const file of validFiles) {
      const tempPath = file.encrypted_path + '.dec';
      await decryptFile(file.encrypted_path, tempPath, file.key_value);
      tempFiles.push(tempPath);
      archive.file(tempPath, { name: file.relative_path || file.original_name });
    }
    
    await archive.finalize();
  } catch (err) {
    console.error('Errore durante il download zip:', err);
    cleanup();
    if (!res.headersSent) {
      res.status(500).send('Errore durante la preparazione del file zip.');
    }
  }

  function cleanup() {
    // Clean up all temporary decrypted files
    tempFiles.forEach(tempPath => {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (err) {
          console.error('Errore durante la pulizia del file temporaneo:', err);
        }
      }
    });
  }

  // Cleanup after response is finished
  res.on('finish', cleanup);
  res.on('error', cleanup);
});

app.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;
  // Recupera info da DB
  const result = await pool.query('SELECT * FROM files WHERE filename = $1', [filename]);
  if (result.rows.length === 0) return res.status(404).send('File not found.');
  const file = result.rows[0];
  // Verifica scadenza
  if (file.expiration && new Date(file.expiration) < new Date()) {
    return res.status(410).send('Link expired.');
  }
  const tempPath = file.encrypted_path + '.dec';
  await decryptFile(file.encrypted_path, tempPath, file.key_value);
  res.download(tempPath, file.original_name, () => {
    fs.unlinkSync(tempPath);
  });
});

// Upload route
app.post('/upload', multer.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const { expiration, email, sendType, password } = req.body;
    if (!files || files.length === 0) return res.status(400).send('No files uploaded.');
    
    const groupId = uuidv4();
    const key = await getOrCreateEncryptionKey();
    const keyResult = await pool.query('SELECT id FROM encryption_keys WHERE key_value = $1', [key]);
    const keyId = keyResult.rows[0].id;

    for (const file of files) {
      const encryptedPath = file.path + '.enc';
      await encryptFile(file.path, encryptedPath, keyId);
      fs.unlinkSync(file.path);
      
      let relativePath = file.originalname;
      if (file.fieldname === 'files' && file.originalname && file.relativePath) {
        relativePath = file.relativePath;
      }
      
      await pool.query(
        `INSERT INTO files (filename, original_name, relative_path, encrypted_path, key_id, expiration, email, group_id, password) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          file.filename,
          file.originalname,
          relativePath,
          encryptedPath,
          keyId,
          expiration ? new Date(expiration) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          email || null,
          groupId,
          password || null
        ]
      );
    }
    
    const groupLink = `http://localhost:3000/group/${groupId}`;
    if (sendType === 'email' && email) {
      try {
        await sendDownloadEmail(email, [{ link: groupLink, originalName: 'Scarica i tuoi file' }]);
      } catch (err) {
        console.error('Errore invio email:', err);
      }
    }
    res.json({ groupLink });
  } catch (err) {
    console.error('Errore durante l\'upload:', err);
    res.status(500).send('Errore durante il caricamento dei file.');
  }
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Serve la pagina React per tutte le altre rotte
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Avvia il server solo dopo l'inizializzazione del database
initializeDatabase()
  .then(() => {
    app.listen(5003, () => {
      console.log('Server running on http://localhost:5003');
    });
  })
  .catch(err => {
    console.error('Errore fatale durante l\'avvio del server:', err);
    process.exit(1);
  });
