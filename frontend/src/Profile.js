import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Profile({ token, username }) {
  const [profile, setProfile] = useState({ bio: '', avatar: null });
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [message, setMessage] = useState('');

  const fetchProfile = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE_URL}/api/profile/`, config);
      setProfile(res.data);
      setBio(res.data.bio);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('bio', bio);
    if (avatar) formData.append('avatar', avatar);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      await axios.put(`${API_BASE_URL}/api/profile/`, formData, config);
      setMessage('Profile updated successfully!');
      fetchProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage('Update failed.');
    }
  };

  return (
    <div className="profile-container">
      <h3>User Profile</h3>
      <div className="profile-info">
        <p><strong>Username:</strong> {username}</p>
        {profile.avatar && <img src={profile.avatar} alt="avatar" className="profile-avatar-large" />}
      </div>

      <form onSubmit={handleUpdate} className="profile-form">
        {message && <p className="status-msg">{message}</p>}
        <div className="form-group">
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
          />
        </div>
        <div className="form-group">
          <label>Avatar Image</label>
          <input
            type="file"
            onChange={(e) => setAvatar(e.target.files[0])}
            accept="image/*"
          />
        </div>
        <button type="submit">Update Profile</button>
      </form>
    </div>
  );
}

export default Profile;
