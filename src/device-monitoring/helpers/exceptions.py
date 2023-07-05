class CollocationBatchNotFound(Exception):
    def __init__(self, message="Batch does not exist", batch_id=""):
        self.message = message
        if batch_id != "":
            self.message = f"Batch with id {batch_id} does not exist"
        super().__init__(self.message)


class CollocationError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)
