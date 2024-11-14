import os
from django.conf import settings
from cloudinary.models import CloudinaryField
from django.db import models


def upload_to(instance, filename):
    folder = instance.get_upload_folder()
    return os.path.join(folder, filename)


class CustomImageField(models.ImageField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/images/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_image.webp')
        super().__init__(*args, **kwargs)


class CustomFileField(models.FileField):
    def __init__(self, *args, **kwargs):
        kwargs['upload_to'] = kwargs.pop('local_upload_to', 'uploads/files/')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        kwargs['default'] = kwargs.get('default', 'uploads/default_file.txt')
        super().__init__(*args, **kwargs)


class CustomCloudinaryField(CloudinaryField):
    def __init__(self, *args, **kwargs):
        kwargs['folder'] = kwargs.pop('cloudinary_folder', 'uploads/cloud')
        kwargs['null'] = kwargs.get('null', True)
        kwargs['blank'] = kwargs.get('blank', True)
        if kwargs.pop('is_image', True):
            kwargs['default'] = 'website/uploads/default_image.webp'
        else:
            kwargs['resource_type'] = 'raw'
            kwargs['default'] = 'website/uploads/default_file.txt'
        super().__init__(*args, **kwargs)


class ConditionalImageField(models.Field):
    def __init__(self, local_upload_to='uploads/images/', cloudinary_folder='uploads/images/', null=True, blank=True, *args, **kwargs):
        if settings.DEBUG:
            field_class = CustomImageField
            kwargs['local_upload_to'] = local_upload_to
        else:
            field_class = CustomCloudinaryField
            kwargs['cloudinary_folder'] = cloudinary_folder

        self.field_instance = field_class(
            null=null,
            blank=blank,
            *args,
            **kwargs
        )
        super().__init__()

    def contribute_to_class(self, cls, name):
        self.field_instance.contribute_to_class(cls, name)


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
