from .abstract_data_source import AbstractDataSource
from .data_source_csv import CSVDataSource
from .data_source_mongo import MongoDataSource


class DataSourceMeta(type):

    def __new__(mcs, name, bases, namespaces, **kwargs):

        for attr_name, attr in namespaces.items():
            if callable(attr) and not issubclass(attr, AbstractDataSource):
                raise Exception(f'{attr_name} attribute must inherit from {AbstractDataSource.__name__}')

        return super().__new__(mcs, name, bases, namespaces)

    def __init__(cls, name, bases, namespaces, **kwargs):
        # A do nothing __init__ to ensure both __new__ and __init__ have similar signature
        super().__init__(name, bases, namespaces)

    def __call__(cls, *args, data_source=None, **kwargs):

        if args:
            raise TypeError(f'Constructor for class {cls.__name__} does not accept positional arguments')

        if data_source:
            klass = super().__call__(*args, **kwargs)

            data_source_class = getattr(klass, data_source, False)

            if not data_source_class:
                raise AttributeError(f'{klass.__class__.__name__} has no attribute {data_source}')

            return data_source_class()

        return super().__call__(*args, **kwargs)


class DataSource(metaclass=DataSourceMeta):
    """Class for accessing data source concrete classes

    Usage:
        DataSource('CSV') to access an instance of the CSVDataSource concrete class
        DataSource.CSVDataSource to access the CSVDataSource concrete class

        Both methods expose the same class methods for working with data sources
    """

    CSV = CSVDataSource
    MONGO = MongoDataSource
