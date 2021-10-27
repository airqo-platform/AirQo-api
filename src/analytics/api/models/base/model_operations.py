from collections.abc import Sequence
from datetime import datetime
from pymongo import ASCENDING, DESCENDING
from bson.objectid import ObjectId


class BaseMongoOperations:
    """contains methods that map directly to the pymongo api"""

    def aggregate(self, stages):
        """
        Am method where documents enter a multi-stage pipeline (defined by the order of the stages) that transforms
        the documents into aggregated results. https://docs.mongodb.com/manual/core/aggregation-pipeline/ for more details
        Args:
            stages: a list that defines various stages to be performed on the documents inorder to achieve a final
                      aggregated results

        Returns: A cursor to the documents that match the query criteria. When the find() method “returns documents,”
                 the method is actually returning a cursor to the documents.

        """

        return self.collection.aggregate(stages)

    def find(self, *args, **kwargs):
        return self.collection.find(*args, **kwargs)

    def sort(self, key, ascending=True):
        if not key:
            raise Exception("sort key cannot be empty")
        return self.collection.find().sort(key, ASCENDING if ascending else DESCENDING)

    def insert(self, new_document):
        """
        Inserts a new document into a collection
        Args:
            new_document (dict): document to be inserted into the collection
        """
        return self.collection.insert(new_document)

    def update_one(self, filter_cond=None, update_fields=None):
        """
        Method to update documents(s)
        Args:
            filter_cond (dict): condition to select the docs to be updated
            update_fields: the document fields to be updated

        Returns : PyMongo Update object
        """
        if not filter_cond:
            raise Exception("filter_cond has to be specified")

        return self.collection.update_one(filter_cond, {'$set': update_fields})

    def delete_one(self, filter_cond):
        """Deletes a document from a collection

        Args:
            filter_cond(dict): condition to select the docs to be updated

        Returns: PyMongo delete object

        """
        return self.collection.delete_one(filter_cond)

    def save(self, item):
        """Saves a document to a collection

        Args:
            item(dict): document to be inserted into a collcetion to select the docs to be updated
        """
        return self.collection.save(item)


class ChainableMongoOperations(BaseMongoOperations):
    ASCENDING = 1
    DESCENDING = -1

    def __init__(self):
        self.stages = []
        self.init_match_expr = "$and"
        self.match_stage = {"$and": []}

    @staticmethod
    def to_object_id(id):
        return ObjectId(id)

    @staticmethod
    def to_object_ids(ids):
        return [ObjectId(ID) for ID in ids]

    def _update_match_stage(self, expression, raise_exc=True, **new_filters):
        """
        Method  for updating the $match pipeline stage.

        Args:
            expression: the mongoDB $match expression e.g $and, $or. more info here https://docs.mongodb.com/manual/reference/operator/aggregation/match/
            **new_filters: a dict containing the new filter conditions
        """
        init_cond = self.match_stage.get(self.init_match_expr) or []

        if raise_exc:
            for v in init_cond:
                if expression in v.keys():
                    raise Exception(f'the {expression} expression already set')

        init_cond.append(new_filters)
        self.match_stage[self.init_match_expr] = init_cond

    def filter_by(self, *args, **filters):
        """
        A filter method that allows for the chaining style of filtering for example
        model.filter_by(first_name='john', last_name='doe').filter_by(city='kampala').exec().
        The chaining is terminated by the exec() method that clears the filter_dict and queries for results

        Args:
            *args: List of positional arguments
            **filters: a dict of the supplied filter conditions

        Returns: the class instance (self) to enable further chaining
        """
        expression = '$and'
        if args:
            raise Exception("positional arguments are not allowed")

        self._update_match_stage(expression, **filters)

        return self

    def in_filter_by(self, **filters):
        """
        A filter method that allows for the chaining style of filtering for example
        model.in_filter_by(first_name='john', last_name='doe').in_filter_by(city='kampala').exec().
        The chaining is terminated by the exec() method that clears the filter_dict and queries for results

        This differs from the filter_by method by;
            1. The values of the filters are sequence
            2. This filter maps to the $in mongodb query operator https://docs.mongodb.com/manual/reference/operator/query/in/

        Args:
            **filters:

        Returns:

        """
        expression = '$in'
        # modified_filters = {}
        for key, value in filters.items():

            if not isinstance(value, list):
                raise Exception("keys must be instance of list")
            self._update_match_stage(expression, raise_exc=False, **{key: {"$in": value}})
        #     modified_filters[key] = {"$in": value}
        #
        # self._update_filter_dict(**modified_filters)

        return self

    def date_range(self, field, start_date, end_date):
        expression = None
        start = datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%S.%fZ')
        end = end_date and datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%S.%fZ') or datetime.now()
        self._update_match_stage(
            expression,
            raise_exc=False,
            **{field: {"$gte": start, "$lt": end}}
        )
        return self

    def or_filter_by(self, **filters):
        """
        A filter method that allows for the chaining style of filtering for example
        model.or_filter_by(first_name='john', last_name='doe').exec().
        The chaining is terminated by the exec() method that clears the filter_dict and queries for results

        This differs from the filter_by method by;
            1. The values of the filters are sequence
            2. This filter maps to the $or mongodb query operator https://docs.mongodb.com/manual/reference/operator/query/or/

        Args:
            **filters:

        Returns:

        """
        expression = '$or'
        modified_filters = []
        for key, value in filters.items():
            modified_filters.append({key: value})
        self._update_match_stage(expression, **{expression: modified_filters})

        return self

    def lookup(self, collection, *args, local_field=None, foreign_field=None, col_as=None):
        """
        A filter method that maps to mongodb's $lookup (https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/)

        Args:
            collection (str): Specifies the collection in the same database to perform the join with.
                                The from collection cannot be shard
            local_field (str): Specifies the field from the documents input to the $lookup stage. $lookup performs an
                                equality match on the localField to the foreignField from the documents of the from
                                collection
            foreign_field (str): Specifies the field from the documents in the from collection. $lookup performs an
                                    equality match on the foreignField to the localField from the input documents.
            col_as: Specifies the name of the new array field to add to the input documents. The new array field
                        contains the matching documents from the from collection.
        """

        self.stages.append(
            {
                "$lookup": {
                    "from": collection,
                    "localField": local_field,
                    "foreignField": foreign_field,
                    "as": col_as or collection
                },
            }
        )

        return self

    def add_stages(self, stages):
        """
        A filter method for adding stage(s) directly to the aggregation stages list.
        More info about stages https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/
        Args:
            stages (list): list of valid mongodb aggregation stage(s)
        """
        self.stages.extend(stages)
        return self

    def replace_root(self, new_root):
        return self.add_stages([{"$replaceRoot": {"newRoot": f"${new_root}"}}])

    def unwind(self, field):
        return self.add_stages([{"$unwind": f'${field}'}])

    def project(self, **fields):
        if fields.get("_id"):
            fields['_id'] = {"$toString": "$_id"}
        return self.add_stages([{"$project": fields}])

    def match(self, **conditions):
        return self.add_stages([{"$match": conditions}])

    def group(self, **conditions):
        return self.add_stages([{"$group": conditions}])

    def sort(self, **conditions):
        return self.add_stages([{"$sort": conditions}])

    def add_fields(self, **fields):
        return self.add_stages([{"$addFields": fields}])

    def match_in(self, **condition):
        for field, value in condition.items():
            if isinstance(value, str) and not isinstance(value, Sequence):
                raise Exception(f'{value} is not a list or tuple (sequence)')
            self.match(**{field: {'$in': value}})
            # self.add_stages([{"$in": [f'${field}', value]}])
        return self

    def _aggregate_exec(self, projections):
        stages = [{"$match": self.match_stage}] if self.match_stage.get(self.init_match_expr) else []
        stages.extend(self.stages)

        if projections:
            mongo_db_project_operator = projections
            if projections.get("_id"):
                mongo_db_project_operator.update({"_id": {"$toString": "$_id"}})
            stages.append({"$project": mongo_db_project_operator})

        return list(self.aggregate(stages))

    def exec(self, projections=None):
        """
        This is a method used to terminate the chained filter query
        Args:
            projections: an optional dict that specifies Specifies the fields to return in the documents that match
                         the query filter. To return all fields in the matching documents, omit this parameter.
                         For details, see https://docs.mongodb.com/manual/reference/method/db.collection.find/#find-projection

        Returns: A cursor to the documents that match the query criteria. When the find() method “returns documents,”
                 the method is actually returning a cursor to the documents.

        """

        return self._aggregate_exec(projections)


class ModelOperations(ChainableMongoOperations):

    def __init__(self):
        super().__init__()

    def convert_model_ids(self, documents):
        docs = list(documents)

        for document in docs:
            for k, v in dict(document).items():
                if k == '_id':
                    document[k] = str(v)
                if v and isinstance(v, list) and isinstance(v[0], dict):
                    self.convert_model_ids(v)
        return docs

