import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLogin, toggleForm }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const response = await axios.post(`${API_BASE_URL}/api/token/`, {
        username,
        password
      });
      const token = response.data.access;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      onLogin(token, username);
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <form onSubmit={handleSubmit}>
          <h2>ChatApp Login</h2>
          {error && <p style={{ color: 'red', fontSize: '0.8rem' }}>{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
        <div className="toggle-link">
          Don't have an account? <span onClick={toggleForm}>Register</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
