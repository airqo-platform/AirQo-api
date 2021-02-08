from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from functools import wraps
import re

# third-party imports
from flask import request

from api.utils.http import Status

@dataclass
class ValidatorResult:
    is_valid: bool
    error_msg: str


@dataclass
class Rule:
    key: str
    validators: list


class Validator(OrderedDict):
    """A custom orderedDict class to ensure the inorder in which the validators are called is preserved"""

    EMAIL_REGEX = re.compile(
        r"^[\-a-zA-Z0-9_]+(\.[\-a-zA-Z0-9_]+)*@[\-a-z]+\.[\-a-zA-Z0-9_]+\Z", re.I | re.UNICODE)

    URL_REGEX = re.compile(
        r"^(http(s)?:\/\/)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$")

    DATA_TYPES = ['csv', 'json']

    def __init__(self, validation_type=''):
        super().__init__()
        self.validation_type = validation_type
        self['required'] = self.type_validator(self.none_checker, "is required")
        self['int'] = self.type_validator(int, "{} is not a valid integer")
        self['float'] = self.type_validator(float, "{} is not a valid float")
        self['list'] = self.type_validator(list, "{} is not a valid list/array")
        self['bool'] = self.type_validator(self.str_to_bool, "{} is not a valid boolean")
        self['dict'] = self.type_validator(dict, "{} is not a valid dict")
        self['str'] = self.type_validator(str, "{} is not a valid string")
        self['date'] = self.type_validator(self.date_checker, "{} is not a valid string")
        self['email'] = self.type_validator(self.email_checker, "{} is not a valid email")
        self['url'] = self.type_validator(self.url_checker, "{} is not a valid url")
        self['data'] = self.type_validator(
            self.data_checker,
            f"{{}} is not a supported data format. Supported data formats are {self.DATA_TYPES}"
        )

    def type_validator(self, type_checker, error_msg):
        def validator(value):
            try:
                type_checker(value)
                return ValidatorResult(is_valid=True, error_msg="")
            except (ValueError, TypeError):
                return ValidatorResult(
                    is_valid=False,
                    error_msg=f'{error_msg.format(value)} (in {self.validation_type})'
                )

        return validator

    @staticmethod
    def str_to_bool(value):
        if str(value).lower() in ['true', '1', 't', 'y', 'yes']:
            return True
        if str(value).lower() in ['false', '0', 'f', 'n', 'no']:
            return False

        raise(TypeError("cannot convert {} to bool type".format(value)))

    @staticmethod
    def date_checker(value):
        try:
            datetime.strptime(value, '%Y-%m-%d')
        except Exception:
            raise TypeError("cannot convert {} to date type".format(value))

    @staticmethod
    def none_checker(value):
        if not value:
            raise TypeError("value can not be none/falsy")

    @classmethod
    def email_checker(cls, value):
        if not cls.EMAIL_REGEX.match(value):
            raise TypeError("invalid email address")

    @classmethod
    def url_checker(cls,value):
        if not re.match(cls.URL_REGEX, value):
            raise TypeError("invalid url")

    @classmethod
    def data_checker(cls, value):
        if value not in cls.DATA_TYPES:
            raise TypeError("invalid data type")

    @staticmethod
    def parse_rule(rule):
        """
        Splits into key and validators components
        Args:
            rule: a str representing a validation rule e.g "email|required:email"

        Returns: a dataclass holding the key and validators extracted from the rule

        """
        try:
            key, validators = rule.split('|')
            return Rule(key=key, validators=validators.split(':'))
        except Exception as exc:
            print(exc)
            raise Exception("Invalid rule")


