const ChatRoom = require('../models/ChatRoom.models');
const Message = require('../models/Message.models');
const { JWTService } = require('./jwt');
const Module = require('../models/Module.models');

module.exports = function(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: token required'));
      // verify token and attach userId
      const userId = JWTService.verifyToken(token, 'userId');
      if (!userId) return next(new Error('Authentication error: invalid token'));
      socket.userId = userId;
      return next();
    } catch (err) {
      console.error('Socket auth error', err);
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'user', socket.userId);

    // Join a room (roomId is ChatRoom._id)
    socket.on('joinRoom', async ({ roomId }) => {
      try {
        socket.join(roomId);
        console.log('User', socket.userId, 'joined room', roomId);

        // Log current sockets in the room for debugging (Socket.IO v3+ uses a Set)
        try {
          const roomInfo = io.sockets.adapter.rooms.get(roomId) || io.sockets.adapter.rooms[roomId];
          let clientsList = [];
          if (roomInfo) {
            if (roomInfo instanceof Set) clientsList = Array.from(roomInfo);
            else if (roomInfo.sockets) clientsList = Object.keys(roomInfo.sockets);
          }
          console.log(`joinRoom: room ${roomId} members sockets:`, clientsList);
        } catch (traceErr) {
          console.warn('Failed to enumerate room members for', roomId, traceErr);
        }

        // Emit last messages for the room
        let messages = await Message.find({ room: roomId }).sort({ createdAt: 1 }).limit(200).populate('sender', 'displayName name');
        // Normalize sender name so client can always read sender.name
        messages = messages.map(m => {
          const mm = m.toObject ? m.toObject() : m;
          if (mm.sender && !mm.sender.name) {
            mm.sender.name = mm.sender.displayName || mm.sender.name || 'Anonymous';
          }
          return mm;
        });
        console.log(`joinRoom: returned ${messages.length} messages for room ${roomId}`);
        socket.emit('roomHistory', messages);
      } catch (err) {
        console.error('joinRoom error', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leaveRoom', ({ roomId }) => {
      try {
        socket.leave(roomId);
        console.log('Socket left room', roomId, socket.id);
      } catch (err) {
        console.error('leaveRoom error', err);
      }
    });

  socket.on('sendMessage', async ({ roomId, content, attachments, _clientId }) => {
      try {
        // Use socket.userId as sender (don't trust client-sent senderId)
        const senderId = socket.userId;

        // Optional: verify that sender is participant of the room (for module rooms)
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // If module room, check membership
        if (room.type === 'module' && room.module) {
          const mod = await Module.findById(room.module);
          const isParticipant = mod && (mod.owner.toString() === senderId.toString() || (mod.members || []).some(m => m.user && m.user.toString() === senderId.toString()));
          if (!isParticipant) {
            socket.emit('error', { message: 'Not a member of the module' });
            return;
          }
        }

        const msg = new Message({ room: roomId, sender: senderId, content, attachments: attachments || [] });
        try {
          await msg.save();
          console.log(`Socket saved message ${msg._id} room=${roomId} user=${senderId}`);
        } catch (saveErr) {
          console.error('Socket failed to save message', saveErr);
          socket.emit('error', { message: 'Failed to save message' });
          return;
        }
  // include sender _id so clients can reliably detect ownership
  const populatedDoc = await msg.populate('sender', 'displayName name _id');
  const populated = populatedDoc.toObject ? populatedDoc.toObject() : populatedDoc;
  // if the client provided a client-side id correlate it so clients can replace optimistic entries
  if (_clientId) populated._clientId = _clientId;
        if (populated.sender && !populated.sender.name) {
          populated.sender.name = populated.sender.displayName || populated.sender.name || 'Anonymous';
        }
        io.to(roomId).emit('newMessage', populated);
        console.log(`Socket emitted newMessage to room ${roomId} from user ${senderId}`);

        // Also log which sockets are currently in the room when emitting
        try {
          const roomInfo = io.sockets.adapter.rooms.get(roomId) || io.sockets.adapter.rooms[roomId];
          let clientsList = [];
          if (roomInfo) {
            if (roomInfo instanceof Set) clientsList = Array.from(roomInfo);
            else if (roomInfo.sockets) clientsList = Object.keys(roomInfo.sockets);
          }
          console.log(`emitTrace: newMessage to room ${roomId} will be sent to sockets:`, clientsList);
        } catch (traceErr) {
          console.warn('emitTrace failed for room', roomId, traceErr);
        }
      } catch (err) {
        console.error('sendMessage error', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
};
