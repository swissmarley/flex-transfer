# Flex Transfer

A secure, self-hosted file transfer application with end-to-end encryption. Built with **React** frontend and **Node.js/Express** backend, featuring PostgreSQL database integration for file management and SMTP support for email notifications.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🎯 Features

- **End-to-End Encryption**: Files are encrypted using AES-256-CBC before being stored on the server
- **Secure File Sharing**: Generate unique shareable links for downloading files
- **Password Protection**: Optionally protect file groups with password authentication
- **Expiration Dates**: Set automatic expiration times for shared files
- **Email Notifications**: Send download links via email (SMTP configured)
- **Folder Structure Preservation**: Upload entire directories while maintaining folder structure
- **Batch Downloads**: Download multiple files as a ZIP archive
- **Modern UI**: Clean, responsive React interface with Material-UI components
- **Docker Support**: Full Docker and Docker Compose configuration for easy deployment
- **Database Persistence**: PostgreSQL for storing file metadata and encryption keys

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and **npm** or **yarn**
- **PostgreSQL** 12+ (or use Docker)
- **Docker & Docker Compose** (optional, for containerized deployment)
- **SMTP Server** credentials (for email functionality, optional)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/swissmarley/flex-transfer.git
   cd flex-transfer
   ```

2. **Environment Setup**
   ```bash
   cd backend
   cp .env.template .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # PostgreSQL Configuration
   PG_HOST=localhost
   PG_PORT=5432
   PG_USER=your_db_user
   PG_PASSWORD=your_db_password
   PG_DATABASE=flex_transfer

   # SMTP Configuration (for email notifications)
   SMTP_HOST=your.smtp.server
   SMTP_PORT=587
   SMTP_USER=your_email@example.com
   SMTP_PASS=your_app_password
   ```

   Install dependencies and start:
   ```bash
   npm install
   npm start
   ```
   
   Backend will run on `http://localhost:5003`

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```
   
   Frontend will run on `http://localhost:3000`

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Prepare environment file**
   ```bash
   cp .env.template .env
   cp backend/.env.template backend/.env
   ```
   
   Configure the `.env` file with your database and SMTP credentials.

2. **Start all services**
   ```bash
   docker-compose up -d
   ```
   
   This will start:
   - **Backend** on port 5000
   - **Frontend** on port 3000
   - **PostgreSQL** database on port 5432

3. **Stop services**
   ```bash
   docker-compose down
   ```

4. **View logs**
   ```bash
   docker-compose logs -f [service_name]
   ```

---

## 📋 Project Structure

```
flex-transfer/
├── backend/
│   ├── index.js                 # Main Express server
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example            # Environment variables template
│   ├── uploads/                # Directory for encrypted files
│   └── upload/
│       └── multer-config.js    # Multer file upload configuration
├── frontend/
│   ├── src/
│   │   ├── App.js              # Main React component
│   │   ├── App.css
│   │   ├── index.js
│   │   └── components/
│   │       └── AnimatedBackground.jsx
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── build/                  # Production build (generated)
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## 🔐 Security Architecture

### Encryption Flow

1. **File Upload**
   - Files are encrypted on the server using **AES-256-CBC**
   - Each file gets a unique initialization vector (IV)
   - Encryption keys are stored securely in PostgreSQL

2. **File Storage**
   - Encrypted files are stored with `.enc` extension
   - Original filenames are kept in database (encrypted in metadata)
   - Temporary decrypted files are cleaned up immediately after download

3. **File Download**
   - Files are decrypted on-the-fly during download
   - Temporary decrypted files are deleted after transfer
   - Optional password verification before access

### Database Schema

The application uses three main tables:

- **encryption_keys**: Stores encryption keys used for file encryption
- **files**: Contains file metadata (names, paths, expiration times, encryption key references)

---

## 🛠️ API Endpoints

### Upload
- **POST** `/upload`
  - Upload files with optional email, expiration, and password protection
  - Form data: `files`, `expiration` (optional), `email` (optional), `password` (optional), `sendType` (link|email)
  - Returns: `{ groupLink: "http://localhost:3000/group/{groupId}" }`

### Download
- **GET** `/group/:groupId/download/:fileId`
  - Download a single file from a group
  - Headers: `x-password` (if password protected)
  - Returns: File download

- **GET** `/group/:groupId/download-zip`
  - Download all files in a group as ZIP
  - Headers: `x-password` (if password protected)
  - Returns: ZIP file download

### File Metadata
- **GET** `/api/group/:groupId`
  - Get list of files in a group
  - Headers: `x-password` (if password protected)
  - Returns: `{ files: [...], message: "..." }`

- **GET** `/api/check-password/:groupId`
  - Check if a group is password protected
  - Returns: `{ hasPassword: boolean }`

- **POST** `/api/verify-password/:groupId`
  - Verify password for a protected group
  - Body: `{ password: "..." }`
  - Returns: `{ valid: boolean }`

---

## 🚀 Deployment

### Cloud Deployment Example (Railway, Heroku, etc.)

1. Set up PostgreSQL database in your cloud provider
2. Configure environment variables in your hosting platform
3. Deploy using Docker image or connect git repository
4. Update frontend API endpoint from `localhost:5003` to your production URL

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PG_HOST` | ✓ | - | PostgreSQL host |
| `PG_PORT` | ✓ | 5432 | PostgreSQL port |
| `PG_USER` | ✓ | - | PostgreSQL user |
| `PG_PASSWORD` | ✓ | - | PostgreSQL password |
| `PG_DATABASE` | ✓ | - | PostgreSQL database name |
| `SMTP_HOST` | ✗ | - | SMTP server host (for email) |
| `SMTP_PORT` | ✗ | 587 | SMTP server port |
| `SMTP_USER` | ✗ | - | SMTP username |
| `SMTP_PASS` | ✗ | - | SMTP password |

---

## 📦 Dependencies

### Backend
- **express**: Web framework
- **multer**: File upload handling
- **pg**: PostgreSQL client
- **nodemailer**: Email sending
- **archiver**: ZIP file creation
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **uuid**: Unique ID generation
- **crypto**: File encryption

### Frontend
- **react**: UI framework
- **@mui/material**: Component library
- **@emotion/react** & **@emotion/styled**: CSS-in-JS styling

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📝 Notes

- **Production Deployment**: For production use, update CORS settings, enforce HTTPS, and configure a proper reverse proxy (nginx, Caddy)
- **File Storage**: Encrypted files are stored in the `backend/uploads/` directory by default
- **Database Backup**: Regularly backup your PostgreSQL database to prevent data loss
- **Security**: Never commit `.env` files. Use environment variables in production
- **Maximum Upload Size**: Configure Multer limits in `backend/upload/multer-config.js` as needed

---

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running and credentials are correct
- Check `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD` in `.env`

### SMTP Email Not Sending
- Verify SMTP credentials are correct
- Some email providers require app-specific passwords
- Check firewall rules allow SMTP port access

### File Upload Fails
- Check `backend/uploads/` directory exists and has write permissions
- Verify available disk space
- Check Multer size limits in `multer-config.js`

### Docker Issues
- Ensure Docker and Docker Compose are installed
- Check port availability (3000, 5000, 5432)
- Review logs: `docker-compose logs`

---

## 📞 Support

For issues or questions, please open an issue on [GitHub](https://github.com/swissmarley/flex-transfer/issues).
