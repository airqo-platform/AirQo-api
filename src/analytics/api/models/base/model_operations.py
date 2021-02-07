from pymongo import ASCENDING, DESCENDING
class ModelOperations:

    def find(self, *args, **kwargs):
        return self.collection.find(*args, **kwargs)

    def sort(self, key, ascending=True):
        if not key:
            raise Exception("sort key cannot be empty")
        return self.collection.find().sort(key, ASCENDING if ascending else DESCENDING)

    def filter_and_sort(self):
        pass
