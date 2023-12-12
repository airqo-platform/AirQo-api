from enum import Enum


class Frequency(Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class JobType(Enum):
    TRAIN = "train"
    PREDICTION = "prediction"
