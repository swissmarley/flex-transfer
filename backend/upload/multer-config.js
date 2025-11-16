const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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