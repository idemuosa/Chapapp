import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import Feed from './Feed';
import VideoCall from './VideoCall';
import People from './People';
import Notifications from './Notifications';
import Profile from './Profile';
import Groups from './Groups';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [view, setView] = useState('chat');
  const [videoTargetId, setVideoTargetId] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [room, setRoom] = useState('general');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!token) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token: `Bearer ${token}` }
    });

    socketRef.current.emit('join_room', room);

    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    axios.get(`${API_BASE_URL}/api/messages/?room=${room}`, config)
      .then(res => setChat(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          handleLogout();
        }
      });

    socketRef.current.on('receive_message', (data) => {
      if (data.room === room) {
        setChat((prev) => [...prev, data]);
      }
    });

    socketRef.current.on('online_users_list', (users) => {
      setOnlineUsers(users);
    });

    socketRef.current.on('user_status', (data) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => [...new Set([...prev, data.user_id.toString()])]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.user_id.toString()));
      }
    });

    const lastSeenInterval = setInterval(() => {
      axios.post(`${API_BASE_URL}/api/profile/update_last_seen/`, {}, config)
        .catch(e => console.error('Last seen update failed', e));
    }, 60000);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(lastSeenInterval);
    };
  }, [room, token]);

  useEffect(() => {
    scrollToBottom();
  }, [chat, view]);

  const handleLogin = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setIsRegistering(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() !== '' && socketRef.current) {
      const msgData = {
        room: room,
        sender: { username: username },
        content: message,
        timestamp: new Date().toISOString()
      };
      socketRef.current.emit('send_message', msgData);
      setMessage('');
    }
  };

  if (!token) {
    if (isRegistering) {
      return <Register
                onRegisterSuccess={() => setIsRegistering(false)}
                toggleForm={() => setIsRegistering(false)}
              />;
    }
    return <Login
              onLogin={handleLogin}
              toggleForm={() => setIsRegistering(true)}
            />;
  }

  return (
    <div className="App">
      <div className="chat-container">
        <header className="header">
          <h2>ChatApp - {view.charAt(0).toUpperCase() + view.slice(1)}</h2>
          <div className="header-actions">
            <span className="user-badge">{username}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </header>

        <nav className="nav-tabs">
          {['chat', 'feed', 'video', 'people', 'notifications', 'profile', 'groups'].map(v => (
            <button
              key={v}
              className={view === v ? 'active' : ''}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>

        <div className="view-content">
          {view === 'chat' ? (
            <div className="chat-view">
              <main className="messages">
                {chat.map((msg, index) => {
                  const isMe = (msg.sender?.username || msg.sender) === username;
                  return (
                    <div key={index} className={`message-wrapper ${isMe ? 'sent' : 'received'}`}>
                      {!isMe && <span className="sender-name">{msg.sender?.username || msg.sender}</span>}
                      <div className="message-bubble">
                        {msg.content}
                        {msg.voice_note && (
                          <div className="voice-note-player">
                            <audio controls src={msg.voice_note} />
                          </div>
                        )}
                      </div>
                      <span className="timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </main>

              <section className="input-area">
                <form onSubmit={sendMessage}>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    autoFocus
                  />
                  <button type="submit">Send</button>
                </form>
              </section>
            </div>
          ) : view === 'feed' ? (
            <Feed token={token} />
          ) : view === 'video' ? (
            <VideoCall
              socket={socketRef.current}
              username={username}
              initialTargetId={videoTargetId}
            />
          ) : view === 'people' ? (
            <People
              token={token}
              onCall={(userId) => {
                setVideoTargetId(userId);
                setView('video');
              }}
            />
          ) : view === 'notifications' ? (
            <Notifications token={token} />
          ) : view === 'profile' ? (
            <Profile token={token} username={username} />
          ) : (
            <Groups token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
