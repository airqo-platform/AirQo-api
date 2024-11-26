import os
from django.conf import settings
from cloudinary.models import CloudinaryField
from django.db import models
from django.core.exceptions import ValidationError
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
from cloudinary.uploader import upload_large


# Validator for allowed image formats
def validate_image_format(file):
    """Validates and compresses the uploaded image."""
    try:
        with Image.open(file) as img:
            img.verify()  # Ensure it's a valid image
            # Compress large images
            if file.size > 2 * 1024 * 1024:  # If larger than 2MB
                buffer = BytesIO()
                img.save(buffer, format='JPEG', optimize=True,
                         quality=85)  # Compress
                # Replace file content
                file.file = ContentFile(buffer.getvalue())
    except Exception:
        raise ValidationError(f"Invalid image file: {file.name}")


# Helper function for custom upload paths
def upload_to(instance, filename):
    folder = instance.get_upload_folder()
    return os.path.join(folder, filename)


# Custom ImageField for local storage
class CustomImageField(models.ImageField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/images/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_image.webp')
        kwargs['validators'] = kwargs.get(
            'validators', [validate_image_format])
        super().__init__(*args, **kwargs)


# Custom FileField for local storage
class CustomFileField(models.FileField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/files/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_file.txt')
        super().__init__(*args, **kwargs)


# Custom CloudinaryField with format validation
class CustomCloudinaryField(CloudinaryField):
    def __init__(self, *args, **kwargs):
        kwargs['folder'] = kwargs.pop('cloudinary_folder', 'uploads/cloud')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['validators'] = kwargs.get(
            'validators', [validate_image_format])
        if kwargs.pop('is_image', True):
            kwargs['default'] = 'website/uploads/default_image.webp'
        else:
            kwargs['resource_type'] = 'raw'
            kwargs['default'] = 'website/uploads/default_file.txt'
        super().__init__(*args, **kwargs)

    def pre_save(self, model_instance, add):
        """Override pre_save to use chunked upload for large files."""
        file = getattr(model_instance, self.attname)
        if file and file.size > 2 * 1024 * 1024:  # Files larger than 2MB
            result = upload_large(file, folder=self.folder,
                                  chunk_size=6 * 1024 * 1024)  # 6MB chunks
            return result['url']
        return super().pre_save(model_instance, add)


# Conditional field for choosing between local and Cloudinary storage for images
class ConditionalImageField(models.Field):
    def __init__(self, local_upload_to='uploads/images/', cloudinary_folder='uploads/images/', null=True, blank=True, *args, **kwargs):
        if settings.DEBUG:
            field_class = CustomImageField
            kwargs['local_upload_to'] = local_upload_to
        else:
            field_class = CustomCloudinaryField
            kwargs['cloudinary_folder'] = cloudinary_folder

        kwargs['validators'] = kwargs.get(
            'validators', [validate_image_format])
        self.field_instance = field_class(
            null=null,
            blank=blank,
            *args,
            **kwargs
        )
        super().__init__()

    def contribute_to_class(self, cls, name):
        self.field_instance.contribute_to_class(cls, name)


# Conditional field for choosing between local and Cloudinary storage for files
class ConditionalFileField(models.Field):
    def __init__(self, local_upload_to='uploads/files/', cloudinary_folder='uploads/files/', null=True, blank=True, *args, **kwargs):
        if settings.DEBUG:
            field_class = CustomFileField
            kwargs['local_upload_to'] = local_upload_to
        else:
            field_class = CustomCloudinaryField
            kwargs['cloudinary_folder'] = cloudinary_folder
            kwargs['is_image'] = False

        self.field_instance = field_class(
            null=null,
            blank=blank,
            *args,
            **kwargs
        )
        super().__init__()

    def contribute_to_class(self, cls, name):
        self.field_instance.contribute_to_class(cls, name)
