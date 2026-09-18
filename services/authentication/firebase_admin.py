import json
import os

class FirebaseAuthService:
    def __init__(self):
        self.project_id = os.getenv("FIREBASE_PROJECT_ID", "")
        self.service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

    @property
    def configured(self) -> bool:
        return bool(self.project_id and self.service_account_json)

    def verify_token(self, token: str) -> dict:
        if not self.configured:
            raise RuntimeError("Firebase Authentication non configuré.")
        try:
            import firebase_admin
            from firebase_admin import auth, credentials
        except ImportError as exc:
            raise RuntimeError("firebase-admin n'est pas installé.") from exc
        try:
            firebase_admin.get_app()
        except ValueError:
            credential = credentials.Certificate(json.loads(self.service_account_json))
            firebase_admin.initialize_app(credential, {"projectId": self.project_id})
        return auth.verify_id_token(token)
