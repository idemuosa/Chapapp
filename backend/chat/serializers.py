from rest_framework import serializers
from .models import Message, Profile, Friendship, Post, Comment, Like, Story, Notification
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    fcm_token = serializers.CharField(source='profile.fcm_token', read_only=True)
    last_seen = serializers.DateTimeField(source='profile.last_seen', read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'fcm_token', 'last_seen']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class FriendshipSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)
    to_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='to_user', write_only=True
    )

    class Meta:
        model = Friendship
        fields = ['id', 'from_user', 'to_user', 'to_user_id', 'status', 'created_at']
        read_only_fields = ['from_user', 'status', 'created_at']

class GroupChatSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='members', many=True, write_only=True
    )

    class Meta:
        model = GroupChat
        fields = ['id', 'name', 'description', 'creator', 'members', 'member_ids', 'avatar', 'created_at']
        read_only_fields = ['creator', 'created_at']

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Profile
        fields = ['username', 'bio', 'avatar']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    class Meta:
        model = Message
        fields = ['id', 'sender', 'content', 'image', 'voice_note', 'room', 'timestamp', 'is_read']

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    class Meta:
        model = Comment
        fields = ['id', 'author', 'content', 'created_at']

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'image', 'created_at', 'comments', 'likes_count']

class StorySerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    class Meta:
        model = Story
        fields = ['id', 'author', 'image', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notification_type', 'post', 'created_at', 'is_read']
