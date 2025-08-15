require('dotenv').config();
const { io } = require('socket.io-client');

const socket = io(process.env.NGROK_URL, {
  path: '/socket.io',
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

socket.on('location', (data) => {
  console.log('📍 Location event:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});