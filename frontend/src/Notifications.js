import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Notifications({ token }) {
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE_URL}/api/notifications/`, config);
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const markRead = async (id) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(`${API_BASE_URL}/api/notifications/${id}/mark_read/`, {}, config);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const getMessage = (notif) => {
    switch(notif.notification_type) {
      case 'friend_request': return `${notif.sender.username} sent you a friend request.`;
      case 'post_like': return `${notif.sender.username} liked your post.`;
      case 'post_comment': return `${notif.sender.username} commented on your post.`;
      default: return 'New notification';
    }
  };

  return (
    <div className="notifications-container">
      <h3>Notifications</h3>
      {notifications.length === 0 && <p>No notifications yet.</p>}
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
          onClick={() => !notif.is_read && markRead(notif.id)}
        >
          <p>{getMessage(notif)}</p>
          <small>{new Date(notif.created_at).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

export default Notifications;
