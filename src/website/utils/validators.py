# backend/utils/validators.py

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


def validate_image(file):
    """
    Validates the uploaded image for allowed extensions and maximum file size.
    Skips validation for existing files during updates.
    """
    if not file or not hasattr(file, 'name'):
        return

    if '.' not in file.name:
        return

    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp']
    extension_validator = FileExtensionValidator(allowed_extensions)

    try:
        extension_validator(file)
    except ValidationError:
        raise ValidationError(
            f"Unsupported file extension. Allowed extensions are: {', '.join(allowed_extensions)}."
        )

    max_size = 25 * 1024 * 1024  # 25 MB
    if file.size > max_size:
        raise ValidationError(
            f"Image size must not exceed {max_size / (1024 * 1024)} MB."
        )


def validate_file(file):
    """
    Validates the uploaded file for allowed extensions and maximum file size.
    Skips validation for existing files during updates.
    """
    if not file or not hasattr(file, 'name'):
        return

    if '.' not in file.name:
        return

    allowed_extensions = ['pdf', 'doc', 'docx',
                          'xls', 'xlsx', 'ppt', 'pptx', 'txt']
    extension_validator = FileExtensionValidator(allowed_extensions)

    try:
        extension_validator(file)
    except ValidationError:
        raise ValidationError(
            f"Unsupported file extension. Allowed extensions are: {', '.join(allowed_extensions)}."
        )

    max_size = 25 * 1024 * 1024  # 25 MB
    if file.size > max_size:
        raise ValidationError(
            f"File size must not exceed {max_size / (1024 * 1024)} MB."
        )
