import firebase_admin
from firebase_admin import credentials, messaging
import os
from django.conf import settings

# Initialize Firebase Admin SDK
# You would need to download your service account key JSON from Firebase Console
# and point to it using an environment variable or a fixed path.
firebase_creds_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')

if firebase_creds_path and os.path.exists(firebase_creds_path):
    cred = credentials.Certificate(firebase_creds_path)
    firebase_admin.initialize_app(cred)

def send_push_notification(user, title, body, data=None):
    """
    Sends a push notification to a specific user via their FCM token.
    """
    if not hasattr(user, 'profile') or not user.profile.fcm_token:
        return

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=user.profile.fcm_token,
    )

    try:
        response = messaging.send(message)
        print('Successfully sent message:', response)
    except Exception as e:
        print('Error sending push notification:', e)
