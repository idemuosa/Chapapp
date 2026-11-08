from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Message, Profile

class ChatAppTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password123')
        self.user2 = User.objects.create_user(username='user2', password='password123')

        # Get JWT Token
        response = self.client.post('/api/token/', {'username': 'user1', 'password': 'password123'})
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_get_profile(self):
        response = self.client.get('/api/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'user1')

    def test_send_message(self):
        data = {
            'room': 'general',
            'content': 'Hello world'
        }
        response = self.client.post('/api/messages/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)

    def test_search_users(self):
        response = self.client.get('/api/search/?q=user2')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'user2')

    def test_create_post(self):
        data = {'content': 'My first post'}
        response = self.client.post('/api/posts/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_reply_message(self):
        msg1 = Message.objects.create(sender=self.user1, content='First message', room='general')
        data = {
            'room': 'general',
            'content': 'Replying to first message',
            'reply_to_id': msg1.id
        }
        response = self.client.post('/api/messages/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data.get('reply_to'))
        self.assertEqual(response.data['reply_to']['id'], msg1.id)
        self.assertEqual(response.data['reply_to']['content'], 'First message')

    def test_create_comment_on_post(self):
        post_res = self.client.post('/api/posts/', {'content': 'Post to comment on'})
        post_id = post_res.data['id']
        comment_res = self.client.post(f'/api/posts/{post_id}/comment/', {'content': 'Great post!'})
        self.assertEqual(comment_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(comment_res.data['content'], 'Great post!')
