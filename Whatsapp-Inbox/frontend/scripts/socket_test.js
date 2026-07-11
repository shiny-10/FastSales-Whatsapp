const { io } = require('socket.io-client');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:8000';
const COMPANY_ID = process.env.COMPANY_ID || 'ffffffff-ffff-ffff-ffff-ffffffffffff';

console.log('Connecting to', SOCKET_URL, 'as test client...');

const socket = io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('connected, socket id =', socket.id);
  console.log('joining company', COMPANY_ID);
  socket.emit('join_company', { company_id: COMPANY_ID });
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err.message || err);
});

socket.on('disconnect', (reason) => {
  console.log('disconnected:', reason);
});

socket.on('NEW_MESSAGE', (payload) => {
  console.log('NEW_MESSAGE received:');
  console.dir(payload, { depth: 3 });
});

socket.on('MESSAGE_STATUS', (p) => console.log('MESSAGE_STATUS', p));
socket.on('NEW_REACTION', (p) => console.log('NEW_REACTION', p));

// keep process alive
setInterval(() => {}, 1000);
