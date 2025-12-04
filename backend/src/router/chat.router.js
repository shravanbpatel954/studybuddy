const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');
const ChatRoom = require('../models/ChatRoom.models');
const Message = require('../models/Message.models');
const Module = require('../models/Module.models');
// Ensure the User model file is loaded so Mongoose has the 'User' model registered
const User = require('../models/User.mdoels');
const { getIo } = require('../utils/socketStore');

// Get or create module chat room
router.get('/module/:moduleId', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    let room = await ChatRoom.findOne({ type: 'module', module: moduleId });
    if (!room) {
      room = new ChatRoom({ name: `Module ${moduleId}`, type: 'module', module: moduleId });
      await room.save();
    }
    res.json({ success: true, room });
  } catch (err) {
    console.error('module chat room error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or create a "global" classroom for the current user.
// This room contains participants who are members (or owners) of any module that the user belongs to.
router.get('/global', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    // Find modules where user is owner or member
    const modules = await Module.find({ $or: [ { owner: userId }, { 'members.user': userId } ] });

    // Collect unique participant ids from those modules
    const participantSet = new Set();
    for (const mod of modules) {
      if (mod.owner) participantSet.add(mod.owner.toString());
      for (const m of (mod.members || [])) {
        if (m.user) participantSet.add(m.user.toString());
      }
    }

    const participants = Array.from(participantSet);

    // Use a shared global room so all users join the same classroom chat
    const roomName = 'global-classroom';
    let room = await ChatRoom.findOne({ type: 'global', name: roomName });
    if (!room) {
      room = new ChatRoom({ name: roomName, type: 'global', participants });
      await room.save();
    } else {
      // Merge participants into the existing room participants set
      const existing = new Set((room.participants || []).map(p => p.toString()));
      for (const p of participants) existing.add(p.toString());
      room.participants = Array.from(existing);
      await room.save();
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('global chat room error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Post a message to a room (persist and emit via socket)
router.post('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user._id;
    console.log(`POST /rooms/${roomId}/messages by user ${userId} contentLen=${(content||'').length}`);

    const room = await ChatRoom.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    // If module room, verify membership
    if (room.type === 'module' && room.module) {
      const mod = await Module.findById(room.module);
      const isParticipant = mod && (mod.owner.toString() === userId.toString() || (mod.members || []).some(m => m.user && m.user.toString() === userId.toString()));
      if (!isParticipant) return res.status(403).json({ success: false, error: 'Not a member of the module' });
    }

    const msg = new Message({ room: roomId, sender: userId, content, attachments: attachments || [] });
    try {
      await msg.save();
      console.log(`Message saved ${msg._id} room=${roomId} user=${userId}`);
    } catch (saveErr) {
      console.error('Failed to save message:', saveErr);
      return res.status(500).json({ success: false, error: 'Failed to save message' });
    }
    // Debug: list registered mongoose model names before populate (helps diagnose MissingSchemaError)
    try {
      const mongoose = require('mongoose');
      console.log('Mongoose registered models:', mongoose.modelNames());
    } catch (mErr) {
      console.warn('Could not list mongoose models', mErr);
    }

    const populatedDoc = await msg.populate('sender', 'displayName name _id');
    const populated = populatedDoc.toObject ? populatedDoc.toObject() : populatedDoc;
    if (populated.sender && !populated.sender.name) {
      populated.sender.name = populated.sender.displayName || populated.sender.name || 'Anonymous';
    }
    // Attach client-provided id (if any) so clients can correlate optimistic messages
    if (req.body && req.body._clientId) populated._clientId = req.body._clientId;

    const io = getIo();
    if (io) {
      // Debug: print the exact object we emit so clients can be diagnosed
      try {
        console.debug && console.debug('Emitting newMessage payload for room', roomId, populated);
      } catch (dErr) {
        console.warn('Failed to debug-log emitted message', dErr);
      }
      io.to(roomId).emit('newMessage', populated);
      console.log(`Emitted newMessage to room ${roomId} from user ${userId}`);

      // REST-side trace: log socket ids that are currently in the room
      try {
        const roomInfo = io.sockets.adapter.rooms.get(roomId) || io.sockets.adapter.rooms[roomId];
        let clientsList = [];
        if (roomInfo) {
          if (roomInfo instanceof Set) clientsList = Array.from(roomInfo);
          else if (roomInfo.sockets) clientsList = Object.keys(roomInfo.sockets);
        }
        console.log(`REST emitTrace: newMessage to room ${roomId} will be sent to sockets:`, clientsList);
      } catch (traceErr) {
        console.warn('REST emitTrace failed for room', roomId, traceErr);
      }
    }

    res.json({ success: true, message: populated });
  } catch (err) {
    console.error('post message error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get messages for a room
router.get('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    let messages = await Message.find({ room: roomId }).sort({ createdAt: 1 }).limit(limit).populate('sender', 'displayName name');
    messages = messages.map(m => {
      const mm = m.toObject ? m.toObject() : m;
      if (mm.sender && !mm.sender.name) {
        mm.sender.name = mm.sender.displayName || mm.sender.name || 'Anonymous';
      }
      return mm;
    });
    res.json({ success: true, messages });
  } catch (err) {
    console.error('get messages error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create or get a direct message (DM) room between current user and another user
router.post('/dm', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ success: false, error: 'userId required' });

    // Ensure we order ids deterministically so we can search for existing DM
    const ids = [userId.toString(), otherUserId.toString()].sort();
    // Find a DM room where participants exactly match these two ids
    let room = await ChatRoom.findOne({ type: 'dm', participants: { $all: ids, $size: 2 } });
    if (!room) {
      // create a friendly name
      const name = `dm-${ids[0]}-${ids[1]}`;
      room = new ChatRoom({ name, type: 'dm', participants: ids });
      await room.save();
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('dm room error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// Debug routes - only intended for local development to inspect Socket.IO room membership
// Protected by verifyToken to avoid public access.
router.get('/debug/rooms', verifyToken, async (req, res) => {
  try {
    const io = getIo();
    if (!io) return res.status(500).json({ success: false, error: 'Socket server not initialized' });
    const rooms = {};
    try {
      const adapterRooms = io.sockets.adapter.rooms;
      // adapterRooms may be a Map (v3+) or an object
      if (adapterRooms instanceof Map) {
        for (const [roomId, setOrInfo] of adapterRooms.entries()) {
          let clients = [];
          if (setOrInfo instanceof Set) clients = Array.from(setOrInfo);
          else if (setOrInfo.sockets) clients = Object.keys(setOrInfo.sockets);
          rooms[roomId] = clients;
        }
      } else if (typeof adapterRooms === 'object') {
        for (const roomId of Object.keys(adapterRooms)) {
          const info = adapterRooms[roomId];
          if (info && info.sockets) rooms[roomId] = Object.keys(info.sockets);
        }
      }
    } catch (traceErr) {
      console.warn('Failed to enumerate adapter rooms', traceErr);
    }
    res.json({ success: true, rooms });
  } catch (err) {
    console.error('debug rooms error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/debug/rooms/:roomId', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const io = getIo();
    if (!io) return res.status(500).json({ success: false, error: 'Socket server not initialized' });
    const adapterRooms = io.sockets.adapter.rooms;
    let clients = [];
    try {
      const roomInfo = adapterRooms instanceof Map ? adapterRooms.get(roomId) : adapterRooms[roomId];
      if (roomInfo) {
        if (roomInfo instanceof Set) clients = Array.from(roomInfo);
        else if (roomInfo.sockets) clients = Object.keys(roomInfo.sockets);
      }
    } catch (traceErr) {
      console.warn('Failed to enumerate room members for', roomId, traceErr);
    }
    res.json({ success: true, roomId, clients });
  } catch (err) {
    console.error('debug room error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
