import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Feed({ token }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [image, setImage] = useState(null);

  const fetchData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const postsRes = await axios.get(`${API_BASE_URL}/api/posts/`, config);
      setPosts(postsRes.data);

      const storiesRes = await axios.get(`${API_BASE_URL}/api/stories/`, config);
      setStories(storiesRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCreateStory = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      await axios.post(`${API_BASE_URL}/api/stories/`, formData, config);
      fetchData();
    } catch (err) {
      console.error('Error creating story:', err);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('content', newPost);
    if (image) formData.append('image', image);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      await axios.post(`${API_BASE_URL}/api/posts/`, formData, config);
      setNewPost('');
      setImage(null);
      fetchPosts();
    } catch (err) {
      console.error('Error creating post:', err);
    }
  };

  const handleLike = async (postId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(`${API_BASE_URL}/api/posts/${postId}/like/`, {}, config);
      fetchPosts();
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  return (
    <div className="feed-container">
      <div className="stories-bar">
        <div className="add-story">
          <label htmlFor="story-upload">+</label>
          <input
            id="story-upload"
            type="file"
            style={{display: 'none'}}
            onChange={handleCreateStory}
          />
          <span>Add Story</span>
        </div>
        {stories.map(story => (
          <div key={story.id} className="story-item">
            <img src={story.image} alt="story" />
            <span>{story.author.username}</span>
          </div>
        ))}
      </div>

      <div className="create-post">
        <form onSubmit={handleCreatePost}>
          <textarea
            placeholder="What's on your mind?"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            required
          />
          <input
            type="file"
            onChange={(e) => setImage(e.target.files[0])}
            accept="image/*"
          />
          <button type="submit">Post</button>
        </form>
      </div>

      <div className="posts-list">
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <strong>{post.author.username}</strong>
              <small>{new Date(post.created_at).toLocaleString()}</small>
            </div>
            <p>{post.content}</p>
            {post.image && <img src={post.image} alt="post" className="post-image" />}
            <div className="post-actions">
              <button onClick={() => handleLike(post.id)}>
                Like ({post.likes_count})
              </button>
              <span>{post.comments.length} Comments</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Feed;
