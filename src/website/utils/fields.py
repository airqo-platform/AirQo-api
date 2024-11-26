import os
import logging
from django.conf import settings
from cloudinary.models import CloudinaryField
from django.db import models
from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError
from io import BytesIO
from django.core.files.base import ContentFile
from cloudinary.uploader import upload_large

# Configure logger
logger = logging.getLogger(__name__)

# Validator for allowed image formats


def validate_image_format(file):
    """Validates the uploaded image and compresses if applicable."""
    try:
        # Open the file to ensure it is a valid image
        with Image.open(file) as img:
            img.verify()  # Verify that it is, in fact, an image

        # Re-open the image for further processing after verify()
        with Image.open(file) as img:
            img_format = img.format.upper()
            valid_formats = ["JPEG", "JPG", "PNG",
                             "WEBP", "GIF", "BMP", "TIFF"]

            if img_format not in valid_formats:
                error_msg = (
                    f"Unsupported image format: {img_format}. "
                    f"Allowed formats: {', '.join(valid_formats)}."
                )
                logger.error(error_msg)
                raise ValidationError(error_msg)

            # Compress image if it is larger than 2MB and compressible
            if file.size > 2 * 1024 * 1024 and img_format in ["JPEG", "JPG", "PNG", "WEBP"]:
                buffer = BytesIO()
                save_kwargs = {"optimize": True, "quality": 85}

                # For PNG, convert to RGB to allow optimization
                if img_format == "PNG" and img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                try:
                    img.save(buffer, format=img_format, **save_kwargs)
                except Exception as e:
                    error_msg = f"Error compressing image {file.name}: {e}"
                    logger.error(error_msg)
                    raise ValidationError(error_msg)

                # Replace file content with compressed content
                file.file = ContentFile(buffer.getvalue())
                file.size = buffer.tell()  # Update file size

    except UnidentifiedImageError:
        error_msg = f"The file '{file.name}' is not a valid image."
        logger.error(error_msg)
        raise ValidationError(error_msg)
    except ValidationError as ve:
        # Re-raise validation errors after logging
        logger.error(f"Validation error for file '{file.name}': {ve.message}")
        raise
    except Exception as e:
        # Catch-all for any other exceptions
        error_msg = f"An unexpected error occurred while processing '{file.name}': {e}"
        logger.error(error_msg)
        raise ValidationError(error_msg)

# Helper function for custom upload paths


def upload_to(instance, filename):
    try:
        folder = instance.get_upload_folder()
    except AttributeError:
        folder = 'uploads/others/'  # Default folder if method not defined
        logger.warning(
            f"Instance '{instance}' does not have 'get_upload_folder' method. "
            f"Using default folder '{folder}'."
        )
    return os.path.join(folder, filename)

# Custom ImageField for local storage


class CustomImageField(models.ImageField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/images/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_image.webp')
        validators = kwargs.get('validators', [])
        validators.append(validate_image_format)
        kwargs['validators'] = validators
        super().__init__(*args, **kwargs)

    def save_form_data(self, instance, data):
        """Override to handle file replacement properly."""
        try:
            super().save_form_data(instance, data)
        except Exception as e:
            logger.error(f"Error saving form data for {self.name}: {e}")
            raise

# Custom FileField for local storage


class CustomFileField(models.FileField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/files/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_file.txt')
        super().__init__(*args, **kwargs)

    def save_form_data(self, instance, data):
        """Override to handle file replacement properly."""
        try:
            super().save_form_data(instance, data)
        except Exception as e:
            logger.error(f"Error saving form data for {self.name}: {e}")
            raise

# Custom CloudinaryField with format validation


class CustomCloudinaryField(CloudinaryField):
    def __init__(self, *args, **kwargs):
        self.folder = kwargs.pop('cloudinary_folder', 'uploads/cloud')
        kwargs['folder'] = self.folder
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        validators = kwargs.get('validators', [])
        validators.append(validate_image_format)
        kwargs['validators'] = validators
        is_image = kwargs.pop('is_image', True)

        if is_image:
            kwargs['default'] = 'website/uploads/default_image.webp'
            kwargs['resource_type'] = 'image'
        else:
            kwargs['default'] = 'website/uploads/default_file.txt'
            kwargs['resource_type'] = 'raw'

        super().__init__(*args, **kwargs)

    def pre_save(self, model_instance, add):
        """Override pre_save to use chunked upload for large files."""
        file = getattr(model_instance, self.attname)
        if not file:
            return super().pre_save(model_instance, add)

        if file.size > 2 * 1024 * 1024:  # Files larger than 2MB
            try:
                upload_result = upload_large(
                    file,
                    folder=self.folder,
                    chunk_size=6 * 1024 * 1024  # 6MB chunks
                )
                url = upload_result.get(
                    'secure_url') or upload_result.get('url')
                if not url:
                    raise ValueError("Upload did not return a URL.")
                return url
            except Exception as e:
                error_msg = f"Failed to upload '{file.name}' to Cloudinary: {e}"
                logger.error(error_msg)
                raise ValidationError(error_msg)
        else:
            return super().pre_save(model_instance, add)

# Conditional field for choosing between local and Cloudinary storage for images


class ConditionalImageField(models.Field):
    def __init__(self, local_upload_to='uploads/images/', cloudinary_folder='uploads/images/', null=True, blank=True, *args, **kwargs):
        if settings.DEBUG:
            field_class = CustomImageField
            field_kwargs = {
                'local_upload_to': local_upload_to,
                'null': null,
                'blank': blank,
                **kwargs
            }
        else:
            field_class = CustomCloudinaryField
            field_kwargs = {
                'cloudinary_folder': cloudinary_folder,
                'null': null,
                'blank': blank,
                **kwargs
            }

        self.field_instance = field_class(**field_kwargs)
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name, **kwargs):
        self.field_instance.contribute_to_class(cls, name, **kwargs)

    def __get__(self, instance, owner):
        return self.field_instance.__get__(instance, owner)

    def __set__(self, instance, value):
        self.field_instance.__set__(instance, value)

# Conditional field for choosing between local and Cloudinary storage for files


class ConditionalFileField(models.Field):
    def __init__(self, local_upload_to='uploads/files/', cloudinary_folder='uploads/files/', null=True, blank=True, *args, **kwargs):
        if settings.DEBUG:
            field_class = CustomFileField
            field_kwargs = {
                'local_upload_to': local_upload_to,
                'null': null,
                'blank': blank,
                **kwargs
            }
        else:
            field_class = CustomCloudinaryField
            field_kwargs = {
                'cloudinary_folder': cloudinary_folder,
                'is_image': False,
                'null': null,
                'blank': blank,
                **kwargs
            }

        self.field_instance = field_class(**field_kwargs)
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name, **kwargs):
        self.field_instance.contribute_to_class(cls, name, **kwargs)

    def __get__(self, instance, owner):
        return self.field_instance.__get__(instance, owner)

    def __set__(self, instance, value):
        self.field_instance.__set__(instance, value)
