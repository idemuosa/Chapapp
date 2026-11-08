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
  const [callType, setCallType] = useState('video');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [room, setRoom] = useState('general');
  const [activeConversationTitle, setActiveConversationTitle] = useState('General Chat');
  const [activeConversationPeer, setActiveConversationPeer] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [, setUserId] = useState(localStorage.getItem('userId') || '');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

    // Fetch friends list for DM conversations
    axios.get(`${API_BASE_URL}/api/friendships/friends/`, config)
      .then(res => setFriends(res.data))
      .catch(e => console.error('Error fetching friends:', e));

    socketRef.current.on('receive_message', (data) => {
      if (data.room === room) {
        setChat((prev) => [...prev, data]);
      }
    });

    socketRef.current.on('online_users_list', (users) => {
      setOnlineUsers(users.map(u => u.toString()));
    });

    socketRef.current.on('user_status', (data) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => [...new Set([...prev, data.user_id.toString()])]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.user_id.toString()));
      }
    });

    socketRef.current.on('user_typing', (data) => {
      if (data.room === room && data.username !== username) {
        setTypingUsers(prev => [...new Set([...prev, data.username])]);
      }
    });

    socketRef.current.on('user_stop_typing', (data) => {
      if (data.room === room) {
        setTypingUsers(prev => prev.filter(u => u !== data.username));
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
  }, [room, token, username]);

  useEffect(() => {
    scrollToBottom();
  }, [chat, view]);

  const handleLogin = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    // Fetch profile to get id
    axios.get(`${API_BASE_URL}/api/profile/`, {
      headers: { Authorization: `Bearer ${newToken}` }
    }).then(res => {
      if (res.data.id) {
        setUserId(res.data.id.toString());
        localStorage.setItem('userId', res.data.id.toString());
      }
    }).catch(err => console.error(err));
    setIsRegistering(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    setToken(null);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (socketRef.current) {
      socketRef.current.emit('typing', { room });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop_typing', { room });
      }, 1500);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() !== '' && socketRef.current) {
      const msgData = {
        room: room,
        sender: { username: username },
        content: message,
        reply_to: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          sender: replyingTo.sender
        } : null,
        reply_to_id: replyingTo ? replyingTo.id : null,
        timestamp: new Date().toISOString()
      };
      socketRef.current.emit('send_message', msgData);
      socketRef.current.emit('stop_typing', { room });
      setMessage('');
      setReplyingTo(null);
    }
  };

  const openGeneralChat = () => {
    setRoom('general');
    setActiveConversationTitle('General Chat');
    setActiveConversationPeer(null);
    setView('chat');
  };

  const openDmChat = (friend) => {
    // Deterministic room name based on IDs or usernames
    const currentName = username;
    const peerName = friend.username;
    const dmRoom = [currentName, peerName].sort().join('_dm_');
    setRoom(dmRoom);
    setActiveConversationTitle(friend.username);
    setActiveConversationPeer(friend);
    setView('chat');
  };

  const handleStartCall = (targetId, type = 'video') => {
    setVideoTargetId(targetId);
    setCallType(type);
    setView('video');
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
            <div className="chat-layout">
              {/* WhatsApp-Style Conversations Sidebar */}
              <aside className="chat-sidebar">
                <div className="sidebar-header">
                  <h4>Chats</h4>
                </div>
                <div className="conversations-list">
                  <div
                    className={`conversation-item ${room === 'general' ? 'active' : ''}`}
                    onClick={openGeneralChat}
                  >
                    <div className="conv-avatar">🌐</div>
                    <div className="conv-info">
                      <span className="conv-title">General Chat</span>
                      <small className="conv-sub">Public group room</small>
                    </div>
                  </div>

                  <div className="sidebar-section-title">Direct Messages</div>
                  {friends.length === 0 ? (
                    <small className="no-friends-hint">Add friends from "People" to DM them!</small>
                  ) : (
                    friends.map(friend => {
                      const isFriendOnline = onlineUsers.includes(friend.id.toString());
                      const isSelected = activeConversationPeer?.id === friend.id;
                      return (
                        <div
                          key={friend.id}
                          className={`conversation-item ${isSelected ? 'active' : ''}`}
                          onClick={() => openDmChat(friend)}
                        >
                          <div className="conv-avatar">
                            {friend.username.charAt(0).toUpperCase()}
                            <span className={`status-dot ${isFriendOnline ? 'online' : 'offline'}`} />
                          </div>
                          <div className="conv-info">
                            <span className="conv-title">{friend.username}</span>
                            <small className="conv-sub">
                              {isFriendOnline ? 'Online' : 'Offline'}
                            </small>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* Chat View Main Panel */}
              <div className="chat-view">
                <div className="chat-active-header">
                  <div className="active-peer-info">
                    <strong>{activeConversationTitle}</strong>
                    {activeConversationPeer && (
                      <span className="peer-status">
                        {onlineUsers.includes(activeConversationPeer.id.toString()) ? '🟢 Online' : '⚪ Offline'}
                      </span>
                    )}
                  </div>
                  {activeConversationPeer && (
                    <div className="active-peer-actions">
                      <button
                        className="quick-call-btn"
                        title="Voice Call"
                        onClick={() => handleStartCall(activeConversationPeer.id, 'audio')}
                      >
                        📞 Audio
                      </button>
                      <button
                        className="quick-call-btn"
                        title="Video Call"
                        onClick={() => handleStartCall(activeConversationPeer.id, 'video')}
                      >
                        📹 Video
                      </button>
                    </div>
                  )}
                </div>

                <main className="messages">
                  {chat.map((msg, index) => {
                    const isMe = (msg.sender?.username || msg.sender) === username;
                    return (
                      <div key={index} className={`message-wrapper ${isMe ? 'sent' : 'received'}`}>
                        {!isMe && <span className="sender-name">{msg.sender?.username || msg.sender}</span>}
                        <div className="message-bubble">
                          {/* Render Reply Quote if present */}
                          {msg.reply_to && (
                            <div className="quoted-message">
                              <span className="quoted-sender">
                                {msg.reply_to.sender?.username || 'User'}
                              </span>
                              <span className="quoted-content">{msg.reply_to.content}</span>
                            </div>
                          )}
                          <div className="msg-text-row">
                            <span>{msg.content}</span>
                            <button
                              className="reply-action-btn"
                              title="Reply"
                              onClick={() => setReplyingTo(msg)}
                            >
                              ↩
                            </button>
                          </div>
                          {msg.voice_note && (
                            <div className="voice-note-player">
                              <audio controls src={msg.voice_note} />
                            </div>
                          )}
                        </div>
                        <span className="timestamp">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <span className="read-receipt"> ✓✓</span>}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </main>

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="typing-indicator">
                    <em>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</em>
                  </div>
                )}

                {/* Replying Banner */}
                {replyingTo && (
                  <div className="replying-banner">
                    <div className="replying-text">
                      <strong>Replying to {replyingTo.sender?.username || 'message'}:</strong>
                      <span>{replyingTo.content.substring(0, 60)}{replyingTo.content.length > 60 ? '...' : ''}</span>
                    </div>
                    <button className="cancel-reply-btn" onClick={() => setReplyingTo(null)}>✕</button>
                  </div>
                )}

                <section className="input-area">
                  <form onSubmit={sendMessage}>
                    <input
                      type="text"
                      value={message}
                      onChange={handleTyping}
                      placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                      autoFocus
                    />
                    <button type="submit">Send</button>
                  </form>
                </section>
              </div>
            </div>
          ) : view === 'feed' ? (
            <Feed token={token} />
          ) : view === 'video' ? (
            <VideoCall
              socket={socketRef.current}
              username={username}
              initialTargetId={videoTargetId}
              initialCallType={callType}
            />
          ) : view === 'people' ? (
            <People
              token={token}
              onlineUsers={onlineUsers}
              onStartChat={(friend) => openDmChat(friend)}
              onCall={(userId, type) => handleStartCall(userId, type)}
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
