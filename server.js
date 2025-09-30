// ============================================
// ARCHIVO: server.js
// Guarda este archivo en la raíz de tu proyecto Replit
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos desde la carpeta public
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Almacén temporal de claves públicas por sala
const roomKeys = new Map();

io.on('connection', (socket) => {
  console.log('✅ Usuario conectado:', socket.id);

  // Usuario se une a una sala
  socket.on('join-room', (data) => {
    const { room, username, publicKey } = data;
    socket.join(room);
    socket.username = username;
    socket.room = room;

    // Almacenar clave pública
    if (!roomKeys.has(room)) {
      roomKeys.set(room, new Map());
    }
    roomKeys.get(room).set(socket.id, { username, publicKey });

    console.log(`👤 ${username} se unió a la sala "${room}"`);

    // Enviar claves públicas existentes al nuevo usuario
    const existingKeys = Array.from(roomKeys.get(room).values())
      .filter(user => user.username !== username);
    
    socket.emit('existing-keys', existingKeys);

    // Notificar a otros usuarios de la nueva clave pública
    socket.to(room).emit('new-public-key', {
      username,
      publicKey,
      socketId: socket.id
    });

    // Notificar a la sala que alguien se unió
    socket.to(room).emit('user-joined', {
      username,
      timestamp: new Date().toISOString()
    });
  });

  // Recibir mensaje encriptado
  socket.on('encrypted-message', (data) => {
    const { room, username, encryptedMessage, timestamp } = data;
    
    // Reenviar el mensaje encriptado a todos en la sala excepto al emisor
    socket.to(room).emit('encrypted-message', {
      username,
      encryptedMessage,
      timestamp,
      socketId: socket.id
    });

    console.log(`🔒 Mensaje encriptado enviado en sala "${room}" por ${username}`);
  });

  // Desconexión
  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      // Limpiar clave pública
      if (roomKeys.has(socket.room)) {
        roomKeys.get(socket.room).delete(socket.id);
        if (roomKeys.get(socket.room).size === 0) {
          roomKeys.delete(socket.room);
        }
      }

      socket.to(socket.room).emit('user-left', {
        username: socket.username,
        timestamp: new Date().toISOString()
      });

      console.log(`❌ ${socket.username} dejó la sala "${socket.room}"`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🔒 CHAT BLINDADO E2EE ACTIVO 🔒    ║
  ╠════════════════════════════════════════╣
  ║   Servidor corriendo en puerto ${PORT}   ║
  ║   Encriptación RSA-2048 habilitada    ║
  ╚════════════════════════════════════════╝
  `);
});
