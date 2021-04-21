"""Module for Validation error and error handler"""


class ValidationError(Exception):
    """Base Validation class for handling validation errors"""

    def __init__(self, error, status_code=None):
        Exception.__init__(self)
        self.status_code = status_code if status_code else 400
        self.error = error
        self.error['status'] = 'error'
        self.error['message'] = error['message']

    def to_dict(self):
        return self.error
