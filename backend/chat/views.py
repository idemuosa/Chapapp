from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Message, Profile, Friendship, Post, Like, Comment, Story, Notification, GroupChat
from .serializers import (
    MessageSerializer, UserSerializer, ProfileSerializer,
    FriendshipSerializer, PostSerializer, CommentSerializer, StorySerializer,
    NotificationSerializer, GroupChatSerializer
)
from .utils import send_push_notification
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class UserSearchView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('q')
        if query:
            return User.objects.filter(
                Q(username__icontains=query) | Q(email__icontains=query)
            ).exclude(id=self.request.user.id)
        return User.objects.none()

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.profile

    @action(detail=False, methods=['post'])
    def set_fcm_token(self, request):
        token = request.data.get('fcm_token')
        if token:
            profile = self.get_object()
            profile.fcm_token = token
            profile.save()
            return Response({'status': 'FCM token updated'})
        return Response({'error': 'Token not provided'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_last_seen(self, request):
        # This can be called internally by the Node.js server
        user_id = request.headers.get('X-Internal-User-ID')
        if user_id:
            try:
                profile = Profile.objects.get(user_id=user_id)
                profile.last_seen = timezone.now()
                profile.save()
                return Response({'status': 'last_seen updated'})
            except Profile.DoesNotExist:
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        profile = self.get_object()
        profile.last_seen = timezone.now()
        profile.save()
        return Response({'status': 'last_seen updated'})

class FriendshipViewSet(viewsets.ModelViewSet):
    serializer_class = FriendshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Friendship.objects.filter(
            Q(from_user=self.request.user) | Q(to_user=self.request.user)
        )

    def perform_create(self, serializer):
        friendship = serializer.save(from_user=self.request.user)
        Notification.objects.create(
            recipient=friendship.to_user,
            sender=self.request.user,
            notification_type='friend_request'
        )
        send_push_notification(
            friendship.to_user,
            "New Friend Request",
            f"{self.request.user.username} sent you a friend request."
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        friendship = self.get_object()
        if friendship.to_user == request.user and friendship.status == 'pending':
            friendship.status = 'accepted'
            friendship.save()
            return Response({'status': 'friendship accepted'})
        return Response({'error': 'cannot accept this request'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def friends(self, request):
        friends_relations = Friendship.objects.filter(
            (Q(from_user=request.user) | Q(to_user=request.user)),
            status='accepted'
        )
        friend_ids = []
        for rel in friends_relations:
            if rel.from_user == request.user:
                friend_ids.append(rel.to_user.id)
            else:
                friend_ids.append(rel.from_user.id)

        friends = User.objects.filter(id__in=friend_ids)
        serializer = UserSerializer(friends, many=True)
        return Response(serializer.data)

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        room = self.request.query_params.get('room')
        if room:
            return self.queryset.filter(room=room).order_by('timestamp')
        return self.queryset

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        message.is_read = True
        message.save()
        return Response({'status': 'message read'})

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
            return Response({'status': 'unliked'})

        # Create Notification
        if post.author != request.user:
            Notification.objects.create(
                recipient=post.author,
                sender=request.user,
                notification_type='post_like',
                post=post
            )
            send_push_notification(
                post.author,
                "New Like",
                f"{request.user.username} liked your post."
            )
        return Response({'status': 'liked'})

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        post = self.get_object()
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(author=request.user, post=post)
            # Create Notification
            if post.author != request.user:
                Notification.objects.create(
                    recipient=post.author,
                    sender=request.user,
                    notification_type='post_comment',
                    post=post
                )
                send_push_notification(
                    post.author,
                    "New Comment",
                    f"{request.user.username} commented on your post."
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class StoryViewSet(viewsets.ModelViewSet):
    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        time_threshold = timezone.now() - timedelta(hours=24)
        return Story.objects.filter(created_at__gt=time_threshold).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification read'})

class GroupChatViewSet(viewsets.ModelViewSet):
    serializer_class = GroupChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.group_chats.all().order_by('-created_at')

    def perform_create(self, serializer):
        # Creator is automatically a member
        group = serializer.save(creator=self.request.user)
        group.members.add(self.request.user)
