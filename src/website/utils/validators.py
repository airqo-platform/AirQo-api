from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


DEFAULT_MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _max_upload_file_size() -> int:
    value = getattr(settings, "UPLOAD_MAX_FILE_SIZE", DEFAULT_MAX_UPLOAD_FILE_SIZE)
    return int(value) if value else DEFAULT_MAX_UPLOAD_FILE_SIZE


def _safe_file_size(file):
    if not hasattr(file, "size"):
        return None
    try:
        size = file.size
    except Exception:
        return None
    try:
        return int(size)
    except (TypeError, ValueError):
        return None


def validate_image(file):
    """
    Validates the uploaded image for allowed extensions and maximum file size.
    Skips validation for existing files during updates.
    """
    if not file or not hasattr(file, 'name'):
        return

    if '.' not in file.name:
        return

    allowed_extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff']
    extension_validator = FileExtensionValidator(allowed_extensions)

    try:
        extension_validator(file)
    except ValidationError:
        raise ValidationError(
            f"Unsupported file extension. Allowed extensions are: {', '.join(allowed_extensions)}."
        )

    size = _safe_file_size(file)
    max_size = _max_upload_file_size()
    if size is not None and size > max_size:
        raise ValidationError(
            f"Image size must not exceed {max_size / (1024 * 1024):.0f} MB."
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

    size = _safe_file_size(file)
    max_size = _max_upload_file_size()
    if size is not None and size > max_size:
        raise ValidationError(
            f"File size must not exceed {max_size / (1024 * 1024):.0f} MB."
        )
