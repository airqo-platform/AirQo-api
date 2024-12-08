# utils/fields.py
import os
import logging
from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.core.files.images import get_image_dimensions
from django.core.validators import FileExtensionValidator
from cloudinary.models import CloudinaryField

logger = logging.getLogger(__name__)

# Maximum size for uploaded images in bytes (10MB)
MAX_IMAGE_SIZE = 10 * 1024 * 1024


def validate_image_format(file):
    """
    Validate that the file is a valid image and does not exceed 10MB.
    Allowed extensions are handled by FileExtensionValidator in the field definition.
    """
    if file.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            f"Image size must not exceed 10MB. Current size: {file.size/1024/1024:.2f}MB.")

    # Check if file is an actual image
    # get_image_dimensions will raise an error if not a valid image
    try:
        get_image_dimensions(file)
    except Exception as e:
        logger.error(f"Invalid image file '{file.name}': {e}")
        raise ValidationError(f"The file '{file.name}' is not a valid image.")


def upload_to(instance, filename):
    """
    A helper function for upload_to. This can be extended to use instance-specific logic.
    If the instance has a `get_upload_folder()` method, use that. Otherwise, use a default folder.
    """
    try:
        folder = instance.get_upload_folder()
    except AttributeError:
        folder = 'uploads/others/'
        logger.warning(
            f"Instance '{instance}' does not have 'get_upload_folder' method. Using default folder '{folder}'."
        )
    return os.path.join(folder, filename)


class CustomImageField(models.ImageField):
    """
    A custom ImageField for local storage.
    Uses FileExtensionValidator and validate_image_format for basic validation.
    """

    def __init__(self, *args, **kwargs):
        # Allowed image extensions
        allowed_extensions = ['jpg', 'jpeg',
                              'png', 'webp', 'gif', 'bmp', 'tiff']

        # Use local_upload_to if provided, else defaults to 'uploads/images/'
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/images/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_image.webp')

        # Append validators
        validators = kwargs.get('validators', [])
        validators.append(FileExtensionValidator(allowed_extensions))
        validators.append(validate_image_format)
        kwargs['validators'] = validators

        super().__init__(*args, **kwargs)


class CustomFileField(models.FileField):
    """
    A custom FileField for local storage.
    Handles files without complex validation, unless you add validators.
    """

    def __init__(self, *args, **kwargs):
        # Use local_upload_to if provided, else defaults to 'uploads/files/'
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/files/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_file.txt')
        super().__init__(*args, **kwargs)


class CustomCloudinaryField(CloudinaryField):
    """
    A custom CloudinaryField that stores files on Cloudinary.
    Uses basic validation for image files and no chunked uploads.
    """

    def __init__(self, *args, **kwargs):
        self.folder = kwargs.pop('cloudinary_folder', 'uploads/cloud')
        kwargs['folder'] = self.folder
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)

        # Determine if this is for an image or a raw file
        is_image = kwargs.pop('is_image', True)

        if is_image:
            kwargs['default'] = 'website/uploads/default_image.webp'
            kwargs['resource_type'] = 'image'
            # Allowed image extensions
            allowed_extensions = ['jpg', 'jpeg',
                                  'png', 'webp', 'gif', 'bmp', 'tiff']
            validators = kwargs.get('validators', [])
            validators.append(FileExtensionValidator(allowed_extensions))
            validators.append(validate_image_format)
            kwargs['validators'] = validators
        else:
            kwargs['default'] = 'website/uploads/default_file.txt'
            kwargs['resource_type'] = 'raw'

        super().__init__(*args, **kwargs)


class ConditionalImageField(models.Field):
    """
    A conditional field that uses local storage if DEBUG is True,
    and Cloudinary if DEBUG is False.
    """

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
                # is_image defaults to True
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


class ConditionalFileField(models.Field):
    """
    A conditional field that uses local storage if DEBUG is True,
    and Cloudinary if DEBUG is False, for non-image files.
    """

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
