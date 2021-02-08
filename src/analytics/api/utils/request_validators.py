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
        self['list'] = self.type_validator(self.list_checker, "{} is not a valid list/array")
        self['bool'] = self.type_validator(self.str_to_bool, "{} is not a valid boolean")
        self['dict'] = self.type_validator(dict, "{} is not a valid dict")
        self['str'] = self.type_validator(str, "{} is not a valid string")
        self['date'] = self.type_validator(self.date_checker, "{} is not a valid date. Date format is '%Y-%M-%D'")
        self['datetime'] = self.type_validator(
            self.datetime_checker,
            "{} is not a valid datetime. Date format is '%Y-%m-%dT%H:%M:%S%z'"
        )
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
    def list_checker(value):
        if not isinstance(value, list):
            raise TypeError("not a valid list")


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
    def datetime_checker(value):
        try:
            datetime.strptime(value, '%Y-%m-%dT%H:%M:%S%z')
        except Exception:
            raise TypeError("cannot convert {} to datetime type".format(value))

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


def request_validator_factory(input_source, info):
    """
    Factory function for creating request validator decorators
    Args:
        input_source: func that request data input source (request.args or request.get_json()
        info: message to be appended in the error messages

    Returns: request decorator

    """
    def validate_request(*rules):
        """decorator for validating query params
        :rules: list -  The sets of keys and rules to be applied
        example: [username|required:str, email|required:email]
        """
        def validate_params(func):
            @wraps(func)
            def decorated(*args, **kwargs):
                source = input_source() or {}
                validator = Validator(validation_type=info)
                errors = {}

                for rule in rules:
                    rule = validator.parse_rule(rule)

                    for validation_type in rule.validators:

                        validation_func = validator.get(validation_type)
                        value = source.get(rule.key)
                        v = validation_func(value)

                        if validation_type != 'required' and not value:
                            continue

                        if not v.is_valid:
                            errors[rule.key] = v.error_msg
                            break

                if errors:
                    return {
                        "status": "error",
                        "message": "an error occurred while processing this request",
                        "errors": errors

                    }, Status.HTTP_400_BAD_REQUEST

                return func(*args, **kwargs)

            return decorated

        return validate_params

    return validate_request


validate_request_params = request_validator_factory(
    input_source=lambda: request.args,
    info="query parameters",
)

validate_request_json = request_validator_factory(
    input_source=lambda: request.get_json(),
    info="json body",
)
