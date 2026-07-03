import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class FirebaseAuthManager:
    _instance = None

    def __init__(self):
        self.db = None
        self.initialize_firebase()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = FirebaseAuthManager()
        return cls._instance

    def initialize_firebase(self):
        """Initialize Firebase Admin SDK & Firestore."""
        try:
            # Check if already initialized
            firebase_admin.get_app()
            print("[INFO] Firebase Admin already initialized.")
            self.db = firestore.client()
        except ValueError:
            # Not initialized, proceed
            cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceaccount.json")
            
            if os.path.exists(cert_path):
                cred = credentials.Certificate(cert_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
                })
                self.db = firestore.client()
                print(f"[OK] Firebase Admin & Firestore initialized using {cert_path}")
            else:
                print(f"[WARN] Firebase service account file '{cert_path}' NOT FOUND. Admin features will be disabled.")

    def get_db(self):
        """Returns the Firestore database instance."""
        if not self.db:
            try:
                self.db = firestore.client()
            except Exception as e:
                print(f"[ERROR] Could not get Firestore client: {e}")
        return self.db

    def verify_id_token(self, id_token):
        """Verifies a Firebase ID token."""
        try:
            # Add clock skew allowance to prevent "Token used too early"
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=60)
            return decoded_token
        except Exception as e:
            print(f"[ERROR] Token verification failed: {e}")
            return None

firebase_auth_manager = FirebaseAuthManager.get_instance()
