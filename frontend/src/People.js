import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function People({ token, onCall }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);

  const config = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    try {
      const friendsRes = await axios.get(`${API_BASE_URL}/api/friendships/friends/`, config);
      setFriends(friendsRes.data);

      const requestsRes = await axios.get(`${API_BASE_URL}/api/friendships/`, config);
      setRequests(requestsRes.data.filter(r => r.status === 'pending'));
    } catch (err) {
      console.error('Error fetching people data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearch(query);
    if (query.length > 2) {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/search/?q=${query}`, config);
        setSearchResults(res.data);
      } catch (err) {
        console.error('Search error:', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/friendships/`, { to_user_id: userId }, config);
      alert('Friend request sent!');
    } catch (err) {
      alert('Request already sent or error occurred.');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/friendships/${requestId}/accept/`, {}, config);
      fetchData();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  return (
    <div className="people-container">
      <div className="search-section">
        <h3>Find People</h3>
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={handleSearch}
        />
        <div className="search-results">
          {searchResults.map(user => (
            <div key={user.id} className="user-item">
              <span>{user.username}</span>
              <div className="item-actions">
                <button onClick={() => sendFriendRequest(user.id)}>Add Friend</button>
                <button className="call-btn-small" onClick={() => onCall(user.id)}>Call</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="requests-section">
        <h3>Friend Requests</h3>
        {requests.length === 0 && <p>No pending requests.</p>}
        {requests.map(req => (
          <div key={req.id} className="user-item">
            <span>{req.from_user.username} sent you a request</span>
            <button onClick={() => acceptRequest(req.id)}>Accept</button>
          </div>
        ))}
      </div>

      <div className="friends-section">
        <h3>Your Friends</h3>
        {friends.length === 0 && <p>Go find some friends!</p>}
        {friends.map(friend => (
          <div key={friend.id} className="user-item">
            <span>{friend.username}</span>
            <div className="item-actions">
              <span className="online-indicator-text">Friend</span>
              <button className="call-btn-small" onClick={() => onCall(friend.id)}>Call</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default People;
