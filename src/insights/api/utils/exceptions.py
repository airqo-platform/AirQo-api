class ExportRequestNotFound(Exception):
    def __init__(self, message="Export request does not exist", request_id=""):
        self.message = message
        if request_id != "":
            self.message = f"Export request with id {request_id} does not exist"
        super().__init__(self.message)
