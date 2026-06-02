from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MessageViewSet, RegisterView, ProfileViewSet, FriendshipViewSet, PostViewSet, UserSearchView, StoryViewSet, NotificationViewSet, GroupChatViewSet

router = DefaultRouter()
router.register(r'messages', MessageViewSet)
router.register(r'friendships', FriendshipViewSet, basename='friendship')
router.register(r'posts', PostViewSet)
router.register(r'stories', StoryViewSet, basename='story')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'groups', GroupChatViewSet, basename='group')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('search/', UserSearchView.as_view(), name='user_search'),
    path('profile/', ProfileViewSet.as_view({'get': 'retrieve', 'put': 'update'}), name='profile'),
]
