import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Groups({ token }) {
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [message, setMessage] = useState('');

  const config = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    try {
      const groupsRes = await axios.get(`${API_BASE_URL}/api/groups/`, config);
      setGroups(groupsRes.data);

      const friendsRes = await axios.get(`${API_BASE_URL}/api/friendships/friends/`, config);
      setFriends(friendsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      setMessage('Please select at least one friend to add to the group.');
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/groups/`, {
        name,
        description,
        member_ids: selectedMembers
      }, config);
      setMessage('Group created successfully!');
      setName('');
      setDescription('');
      setSelectedMembers([]);
      fetchData();
    } catch (err) {
      console.error('Error creating group:', err);
      setMessage('Failed to create group.');
    }
  };

  const toggleMember = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter(mid => mid !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  return (
    <div className="groups-container">
      <h3>Your Groups</h3>
      <div className="groups-list">
        {groups.length === 0 && <p>No groups joined yet.</p>}
        {groups.map(group => (
          <div key={group.id} className="group-item">
            <strong>{group.name}</strong>
            <p>{group.description}</p>
            <small>{group.members.length} members</small>
          </div>
        ))}
      </div>

      <hr />

      <h3>Create New Group</h3>
      <form onSubmit={handleCreateGroup} className="create-group-form">
        {message && <p className="status-msg">{message}</p>}
        <input
          type="text"
          placeholder="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="members-selection">
          <p>Select Friends to Add:</p>
          {friends.map(friend => (
            <div key={friend.id} className="friend-checkbox">
              <input
                type="checkbox"
                id={`friend-${friend.id}`}
                checked={selectedMembers.includes(friend.id)}
                onChange={() => toggleMember(friend.id)}
              />
              <label htmlFor={`friend-${friend.id}`}>{friend.username}</label>
            </div>
          ))}
        </div>

        <button type="submit">Create Group</button>
      </form>
    </div>
  );
}

export default Groups;
