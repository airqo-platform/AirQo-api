import abc


class AbstractDataSource(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def get_boundary_layer_data(self):
        """Abstract method for getting boundary layer data"""
        pass

    @abc.abstractmethod
    def get_meta_data(self):
        """Abstract method for getting meta data"""
        pass

    @abc.abstractmethod
    def get_forecast_data(self):
        """Abstract method for getting forecast data"""
        pass

    @abc.abstractmethod
    def get_data(self):
        """Abstract method for getting all training data"""
        pass

    @classmethod
    def __subclasshook__(cls, sub):
        """Method to check for subclasses and instances (including virtual sub-classes) of AbstractDataSource

        :param sub (class): sub class to check
        :return: boolean True or NotImplemented
        """
        return (
                (
                        hasattr(sub, 'get_boundary_layer_data') and callable(sub.get_boundary_layer_datal) and
                        hasattr(sub, 'get_meta_data') and callable(sub.get_meta_data) and
                        hasattr(sub, 'get_forecast_dat') and callable(sub.get_forecast_dat) and
                        hasattr(sub, 'get_data') and callable(sub.get_data)
                )
                or NotImplemented
        )
