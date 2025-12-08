import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { Box, Button, Typography, Radio, RadioGroup, FormControlLabel, TextField, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Paper, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import ZipIcon from '@mui/icons-material/Archive';
import AnimatedBackground from "./components/AnimatedBackground";

const fileTypeIcon = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) return "🖼️";
  if (["pdf"].includes(ext)) return "📄";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";
  if (["mp4", "avi", "mov", "wmv", "mkv"].includes(ext)) return "🎬";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📈";
  return "📁";
};

// Utility per ottenere il groupId dalla URL
function getGroupIdFromPath() {
  const match = window.location.pathname.match(/\/group\/([\w-]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  const [expiration, setExpiration] = useState('');
  const [sendType, setSendType] = useState('link');
  const [groupLink, setGroupLink] = useState('');
  const [groupFiles, setGroupFiles] = useState([]);
  const [password, setPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const groupBoxRef = useRef();
  const dropRef = useRef();

  // Visualizzazione file da link di download
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file');
    if (fileParam) {
      // Recupera info file dal backend
      fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/download/${fileParam}`)
        .then(res => {
          if (res.status === 410) setStatus('Link scaduto.');
          else if (res.status === 404) setStatus('File non trovato.');
          else if (res.ok) setStatus('File pronto per il download!');
        });
    }
  }, []);

  // Verifica se il gruppo richiede una password
  useEffect(() => {
    const groupId = getGroupIdFromPath();
    if (groupId) {
      fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/api/check-password/${groupId}`)
        .then(res => res.json())
        .then(data => {
          setIsPasswordProtected(data.hasPassword);
        })
        .catch(err => {
          console.error('Errore nel controllo password:', err);
        });
    }
  }, []);

  // Carica lista file se si apre un link di gruppo
  useEffect(() => {
    const groupId = getGroupIdFromPath();
    if (groupId && (!isPasswordProtected || isPasswordValid)) {
      setLoading(true);
      setStatus('Caricamento file...');
      const headers = {};
      if (isPasswordValid) {
        headers['x-password'] = enteredPassword;
      }

      fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/api/group/${groupId}`, {
        method: 'GET',
        headers: headers
      })
        .then(async res => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Errore nel caricamento dei file');
          }
          return res.json();
        })
        .then(data => {
          if (!data.files || !Array.isArray(data.files)) {
            throw new Error('Formato dati non valido');
          }
          setGroupFiles(data.files);
          setStatus(data.files.length > 0 ? 'File disponibili per il download:' : 'Nessun file trovato.');
        })
        .catch(err => {
          console.error('Errore nel caricamento dei file:', err);
          setStatus(err.message || 'Errore nel caricamento dei file.');
        })
        .finally(() => setLoading(false));
    }
  }, [isPasswordProtected, isPasswordValid, enteredPassword]);

  // Adatta dinamicamente la larghezza del container in base ai nomi file
  useEffect(() => {
    if (groupFiles.length > 0 && groupBoxRef.current) {
      const maxLen = Math.max(...groupFiles.map(f => (f.relativePath || f.originalName || '').length), 20);
      groupBoxRef.current.style.minWidth = Math.min(600, 20 + maxLen * 12) + 'px';
      groupBoxRef.current.style.maxWidth = '90vw';
    }
  }, [groupFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const items = e.dataTransfer.items;
    if (items) {
      const files = [];
      const processEntry = async (entry) => {
        if (entry.isFile) {
          const file = await new Promise((resolve) => entry.file(resolve));
          file.relativePath = entry.fullPath;
          files.push(file);
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const entries = await new Promise((resolve) => {
            reader.readEntries((entries) => resolve(entries));
          });
          await Promise.all(entries.map(processEntry));
        }
      };

      Promise.all(
        Array.from(items)
          .map(item => item.webkitGetAsEntry())
          .filter(entry => entry != null)
          .map(processEntry)
      ).then(() => {
        setFiles(files);
      });
    } else if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePasswordSubmit = (groupId) => {
    fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/api/verify-password/${groupId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: enteredPassword })
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setIsPasswordValid(true);
        } else {
          setStatus('Password non valida');
        }
      })
      .catch(err => {
        console.error('Errore nella verifica della password:', err);
        setStatus('Errore nella verifica della password');
      });
  };

  const uploadFiles = useCallback(async () => {
    if (!files.length) return;
    setLoading(true);
    setStatus('Caricamento in corso...');
    setProgress(0);
    const formData = new FormData();
    for (let file of files) {
      formData.append('files', file);
    }
    if (email) formData.append('email', email);
    if (expiration) formData.append('expiration', expiration);
    formData.append('sendType', sendType);
    if (password) formData.append('password', password);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      setLoading(false);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        setGroupLink(data.groupLink);
        setStatus('Caricamento completato!');
      } else {
        setStatus('Errore durante il caricamento.');
      }
    };
    xhr.onerror = () => {
      setLoading(false);
      setStatus('Errore di rete.');
    };
    xhr.send(formData);
  }, [files, email, expiration, sendType, password]);

  // Funzione per anteprima immagini lato frontend (solo per file caricati dal client)
  const getImagePreview = (file) => {
    if (!file || !/^image\//.test(file.type)) return null;
    return URL.createObjectURL(file);
  };

  const downloadFile = (groupId, fileId) => {
    const passwordParam = isPasswordValid ? `?password=${encodeURIComponent(enteredPassword)}` : '';
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/group/${groupId}/download/${fileId}${passwordParam}`;
  };

  const downloadZip = (groupId) => {
    const passwordParam = isPasswordValid ? `?password=${encodeURIComponent(enteredPassword)}` : '';
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5003'}/group/${groupId}/download-zip${passwordParam}`;
  };

  return (
    <Box className="app-container">
      <AnimatedBackground />
      <Box className="background-overlay" />
      <Paper elevation={6} className="upload-box glass-effect" ref={groupBoxRef}>
        <Box className="upload-box-header">
          <Typography variant="h4" align="center" gutterBottom>Secure File Transfer</Typography>
          <Typography variant="subtitle1" align="center" gutterBottom>Invia file e cartelle con crittografia end-to-end</Typography>
          {!getGroupIdFromPath() && (
            <RadioGroup row value={sendType} onChange={e => setSendType(e.target.value)} sx={{ justifyContent: 'center', mb: 2 }}>
              <FormControlLabel value="link" control={<Radio icon={<LinkIcon />} checkedIcon={<LinkIcon color="primary" />} />} label="Solo link" />
              <FormControlLabel value="email" control={<Radio icon={<EmailIcon />} checkedIcon={<EmailIcon color="primary" />} />} label="Invia email" />
            </RadioGroup>
          )}
        </Box>

        {!getGroupIdFromPath() ? (
          // Form di upload
          <>
            <Box
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              sx={{ border: '2px dashed #90caf9', borderRadius: 2, p: 2, mb: 2, textAlign: 'center', bgcolor: '#e3f2fd', cursor: 'pointer' }}
              onClick={() => document.getElementById('file-input').click()}
            >
              <CloudUploadIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="body1">Trascina qui file/cartelle o clicca per selezionare</Typography>
              <input
                id="file-input"
                type="file"
                multiple
                webkitdirectory="true"
                directory="true"
                style={{ display: 'none' }}
                onChange={e => setFiles(Array.from(e.target.files))}
              />
            </Box>
            {sendType === 'email' && (
              <TextField
                type="email"
                label="Email destinatario"
                value={email}
                onChange={e => setEmail(e.target.value)}
                fullWidth
                margin="dense"
              />
            )}
            <TextField
              type="date"
              label="Scadenza (opzionale)"
              value={expiration}
              onChange={e => setExpiration(e.target.value)}
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="password"
              label="Password (opzionale)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              margin="dense"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<CloudUploadIcon />}
              onClick={uploadFiles}
              disabled={loading || !files.length || (sendType === 'email' && !email)}
              fullWidth
              sx={{ mt: 2, mb: 2 }}
            >
              {loading ? 'Caricamento...' : 'Carica File/Cartella'}
            </Button>
            {loading && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />}
            {status && <Typography color="primary" align="center" sx={{ mb: 2 }}>{status}</Typography>}
            {files.length > 0 && (
              <Box className="file-list" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">File selezionati:</Typography>
                <List dense>
                  {files.map((f, i) => (
                    <ListItem key={i}>
                      <ListItemIcon>
                        {/^image\//.test(f.type) ? (
                          <img src={getImagePreview(f)} alt="preview" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                        ) : <InsertDriveFileIcon color="action" />}
                      </ListItemIcon>
                      <ListItemText primary={f.webkitRelativePath || f.name} secondary={`${(f.size / 1024 / 1024).toFixed(2)} MB`} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {groupLink && (
              <Box className="download-section" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Link unico per scaricare tutti i file:</Typography>
                <Button variant="outlined" color="primary" startIcon={<LinkIcon />} href={groupLink} target="_blank" fullWidth>{groupLink}</Button>
              </Box>
            )}
          </>
        ) : (
          <>
            {isPasswordProtected && !isPasswordValid ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1" gutterBottom>
                  Questo contenuto è protetto da password
                </Typography>
                <TextField
                  type="password"
                  label="Inserisci la password"
                  value={enteredPassword}
                  onChange={e => setEnteredPassword(e.target.value)}
                  fullWidth
                  margin="dense"
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handlePasswordSubmit(getGroupIdFromPath())}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  Verifica Password
                </Button>
              </Box>
            ) : (
              <Box className="file-list">
                {status && <Typography color="primary" sx={{ mb: 2 }}>{status}</Typography>}
                {groupFiles.length > 0 && (
                  <>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<ZipIcon />}
                      onClick={() => downloadZip(getGroupIdFromPath())}
                      sx={{ mb: 2, width: '100%' }}
                    >
                      Scarica tutto in ZIP
                    </Button>
                    <List>
                      {groupFiles.map((f, i) => (
                        <ListItem key={i} divider>
                          <ListItemIcon>
                            {fileTypeIcon(f.originalName)}
                          </ListItemIcon>
                          <ListItemText
                            primary={f.relativePath || f.originalName}
                            secondary={`${(f.size / 1024 / 1024).toFixed(2)} MB`}
                            sx={{ wordBreak: 'break-all' }}
                          />
                          <IconButton
                            color="primary"
                            onClick={() => downloadFile(getGroupIdFromPath(), f.id)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}