import React, { FC, useEffect, useRef, useState } from 'react';
import { 
  DownloadIcon, 
  Share2Icon, 
  Trash2Icon, 
  SaveIcon,
  FolderOpenIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
const SERVER_URL = import.meta.env.VITE_SERVER_URL; // Backend server URL
import SessionsModal from '../session-modal'

interface Session {
  roomId: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DrawingData {
  type: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  whiteboardId?: number;
  timestamp?: Date;
}

interface Point {
  x: number;
  y: number;
}

type DrawEvent = React.MouseEvent<HTMLCanvasElement> | Touch;

const Whiteboard: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [color, setColor] = useState<string>('#000000');
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<string>('');
  const [lineWidth, setLineWidth] = useState<number>(2);
  const lastPoint = useRef<Point | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [usersInRoom, setUsersInRoom] = useState<number>(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessionName, setSessionName] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions`);
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const handleSaveSession = async () => {
    if (!joinedRoom) return;
    
    try {
      await fetch(`${SERVER_URL}/api/sessions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: joinedRoom,
          name: sessionName || `Session ${new Date().toLocaleString()}`
        }),
      });
      
      setSessionName('');
      await fetchSessions();
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('roomUsers', (count: number) => {
      console.log(count)
      setUsersInRoom(count);
    });

    socket.on('draw', (data: DrawingData) => {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
    });

    socket.on('clear', () => {
      clearCanvas();
    });

    socket.on('loadWhiteboard', (drawingData: DrawingData[]) => {
      clearCanvas();
      drawingData.forEach(data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const updateCanvasSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  const drawLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    width: number
  ): void => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  };

  const clearCanvas = (): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCoordinates = (event: MouseEvent | Touch, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      // @ts-ignore
      x: ('clientX' in event ? event.clientX : event.pageX) - rect.left,
      // @ts-ignore
      y: ('clientY' in event ? event.clientY : event.pageY) - rect.top
    };
  };

  const handleMouseDown = (event: DrawEvent): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    // @ts-ignore
    const coords = getCoordinates('clientX' in event ? event : event, canvas);
    lastPoint.current = coords;
  };

  const handleMouseMove = (event: DrawEvent): void => {
    if (!isDrawing || !canvasRef.current || !lastPoint.current) return;

    const canvas = canvasRef.current;
    // @ts-ignore
    const newCoords = getCoordinates('clientX' in event ? event : event, canvas);

    drawLine(
      lastPoint.current.x,
      lastPoint.current.y,
      newCoords.x,
      newCoords.y,
      color,
      lineWidth
    );

    // Emit drawing data to server
    const drawingData: DrawingData = {
      type: 'draw',
      x0: lastPoint.current.x,
      y0: lastPoint.current.y,
      x1: newCoords.x,
      y1: newCoords.y,
      color,
      width: lineWidth,
      timestamp: new Date()
    };

    socketRef.current?.emit('draw', { ...drawingData, roomId: joinedRoom });
    lastPoint.current = newCoords;
  };

  const handleMouseUp = (): void => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const handleJoinRoom = (): void => {
    if (roomId) {
      socketRef.current?.emit('joinRoom', { roomId });
      setJoinedRoom(roomId);
    }
  };

  const handleClear = (): void => {
    clearCanvas();
    socketRef.current?.emit('clear', { roomId: joinedRoom });
  };

  const handleSave = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard-${joinedRoom}-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };
  console.log(roomId, joinedRoom)

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div className="flex items-center space-x-4">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 border-none cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-32"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClear}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Trash2Icon size={20} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <DownloadIcon size={20} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSessionsModal(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <FolderOpenIcon size={20} />
          </motion.button>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="px-3 py-1 border rounded-lg"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleJoinRoom}
              className="flex items-center px-4 py-1 space-x-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
              disabled={!isConnected}
            >
              <Share2Icon size={16} />
              <span>Join Room</span>
            </motion.button>
          </div>
        </div>
      </div>

      {joinedRoom && (
        <div className="flex items-center justify-between p-4 py-0 pb-2 bg-white shadow-sm text-black">
          <div>Connected to room: {joinedRoom}</div>
          <div>Users in room: {usersInRoom}</div>
          <div className="flex items-center justify-center space-x-1">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Session name (optional)"
              className="px-2 border rounded-lg"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveSession}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <SaveIcon size={20} />
            </motion.button>
          </div>
        </div>
      )}
      
      <div className="flex-1 p-4">
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-white rounded-lg shadow-lg cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            e.preventDefault();
            // @ts-ignore
            handleMouseDown(e.touches[0]);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            // @ts-ignore
            handleMouseMove(e.touches[0]);
          }}
          onTouchEnd={handleMouseUp}
        />
      </div>

      <SessionsModal
        sessions={sessions}
        showSessionsModal={showSessionsModal}
        setShowSessionsModal={setShowSessionsModal}
        setRoomId={setRoomId}
        handleJoinRoom={handleJoinRoom}
      />
    </div>
  );
};

export default Whiteboard;
