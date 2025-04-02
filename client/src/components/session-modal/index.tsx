import { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SessionModal: FC<any> = ({ sessions, showSessionsModal, setShowSessionsModal, setRoomId, handleJoinRoom }) => (
  <AnimatePresence>
    {showSessionsModal && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={() => setShowSessionsModal(false)}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-auto"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold mb-4 text-gray-600">Saved Sessions</h2>
          <div className="space-y-4">
            {sessions.map((session: any) => (
              <div
                key={session.roomId}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setRoomId(session.roomId);
                  setShowSessionsModal(false);
                }}
              >
                <div className="font-medium text-gray-600">
                  {session.name || `Session ${new Date(session.createdAt).toLocaleString()}`}
                </div>
                <div className="text-sm text-gray-500">
                  Room: {session.roomId} | Last updated: {new Date(session.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-center text-gray-500">
                No saved sessions found
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default SessionModal;
