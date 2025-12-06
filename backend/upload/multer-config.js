const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    // Mantieni il percorso relativo originale nel file
    if (file.originalname.includes('/')) {
      file.relativePath = file.originalname;
    }
    cb(null, uniqueName);
  }
});

module.exports = multer({ 
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB per file
    files: 2000 // fino a 2000 file per upload
  }
});
