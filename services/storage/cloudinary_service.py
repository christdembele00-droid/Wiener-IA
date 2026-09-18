import os
import cloudinary
import cloudinary.uploader

class CloudinaryService:
    def __init__(self):
        self.cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
        self.api_key = os.getenv("CLOUDINARY_API_KEY", "")
        self.api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
        self.configured = bool(self.cloud_name and self.api_key and self.api_secret)
        if self.configured:
            cloudinary.config(cloud_name=self.cloud_name, api_key=self.api_key, api_secret=self.api_secret, secure=True)

    def upload(self, file_path: str, resource_type: str = "auto") -> dict:
        if not self.configured:
            raise RuntimeError("Cloudinary non configuré.")
        return cloudinary.uploader.upload(file_path, resource_type=resource_type)
