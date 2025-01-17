require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"]
  }
});
app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST"],
}));
app.use(express.json());

// PostgreSQL connection using Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});

// Define models
const Whiteboard = sequelize.define('Whiteboard', {
  roomId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const DrawingData = sequelize.define('DrawingData', {
  whiteboardId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Whiteboard,
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  x0: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  y0: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  x1: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  y1: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true
  },
  width: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// Set up relationships
Whiteboard.hasMany(DrawingData);
DrawingData.belongsTo(Whiteboard);

const rooms = new Map(); // Track users in rooms

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('joinRoom', async ({ roomId }) => {
    try {
      // Leave previous room if any
      if (socket.roomId) {
        socket.leave(socket.roomId);
        rooms.set(socket.roomId, (rooms.get(socket.roomId) || 1) - 1);
        io.to(socket.roomId).emit('roomUsers', rooms.get(socket.roomId) || 0);
      }

      // Join new room
      socket.join(roomId);
      socket.roomId = roomId;
      rooms.set(roomId, (rooms.get(roomId) || 0) + 1);
      io.to(roomId).emit('roomUsers', rooms.get(roomId));
      console.log(`User ${socket.id} joined room ${roomId}`);

      // Find or create whiteboard
      const [whiteboard] = await Whiteboard.findOrCreate({
        where: { roomId },
        defaults: { roomId }
      });

      // Load existing drawing data
      const drawingData = await DrawingData.findAll({
        where: { whiteboardId: whiteboard.id },
        order: [['timestamp', 'ASC']]
      });

      socket.emit('loadWhiteboard', drawingData);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  // Handle drawing
  socket.on('draw', async (data) => {
    const { roomId, ...drawingData } = data;
    socket.to(roomId).emit('draw', drawingData);

    try {
      // Get whiteboard ID
      const whiteboard = await Whiteboard.findOne({
        where: { roomId }
      });

      if (whiteboard) {
        // Save drawing data
        await DrawingData.create({
          ...drawingData,
          whiteboardId: whiteboard.id
        });

        // Update whiteboard timestamp
        await whiteboard.update({ updatedAt: new Date() });
      }
    } catch (error) {
      console.error('Error saving drawing:', error);
    }
  });

  // Handle clear canvas
  socket.on('clear', async ({ roomId }) => {
    socket.to(roomId).emit('clear');
    
    try {
      const whiteboard = await Whiteboard.findOne({
        where: { roomId }
      });

      if (whiteboard) {
        // Delete all drawing data for this whiteboard
        await DrawingData.destroy({
          where: { whiteboardId: whiteboard.id }
        });

        // Update whiteboard timestamp
        await whiteboard.update({ updatedAt: new Date() });
      }
    } catch (error) {
      console.error('Error clearing whiteboard:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.roomId) {
      rooms.set(socket.roomId, (rooms.get(socket.roomId) || 1) - 1);
      io.to(socket.roomId).emit('roomUsers', rooms.get(socket.roomId) || 0);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/api/sessions', async (req, res) => {
  try {
    const whiteboards = await Whiteboard.findAll({
      attributes: ['id', 'roomId', 'name', 'createdAt', 'updatedAt'],
      order: [['updatedAt', 'DESC']]
    });
    res.json(whiteboards);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/sessions/save', async (req, res) => {
  const { roomId, name } = req.body;
  try {
    const [whiteboard, created] = await Whiteboard.findOrCreate({
      where: { roomId },
      defaults: { 
        roomId,
        name: name || `Session ${new Date().toLocaleString()}`
      }
    });

    if (!created && name) {
      await whiteboard.update({ name });
    }

    res.json({ success: true, whiteboard });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.get('/api/sessions/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const whiteboard = await Whiteboard.findOne({
      where: { roomId },
      include: [{
        model: DrawingData,
        order: [['timestamp', 'ASC']]
      }]
    });
    
    if (!whiteboard) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(whiteboard);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Sync database and start server
(async () => {
  try {
    await sequelize.sync();
    console.log('Database synchronized');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to sync database:', error);
  }
})();
