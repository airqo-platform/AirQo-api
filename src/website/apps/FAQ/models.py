from django.db import models
from utils.models import BaseModel


class FAQ(BaseModel):
    question = models.CharField(max_length=160)
    answer = models.TextField()

    def __str__(self):
        return self.question
