import React, { useState } from 'react';
import axios from 'axios';

function Register({ onRegisterSuccess, toggleForm }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      await axios.post(`${API_BASE_URL}/api/register/`, {
        username,
        email,
        password
      });
      onRegisterSuccess();
    } catch (err) {
      setError('Registration failed. Username might be taken.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <form onSubmit={handleSubmit}>
          <h2>Create Account</h2>
          {error && <p style={{ color: 'red', fontSize: '0.8rem' }}>{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Register</button>
        </form>
        <div className="toggle-link">
          Already have an account? <span onClick={toggleForm}>Login</span>
        </div>
      </div>
    </div>
  );
}

export default Register;
