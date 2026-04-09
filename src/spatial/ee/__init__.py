"""Compatibility shim for the Earth Engine Python API.

This project imports ``ee`` directly from ``src/spatial`` when the Flask app
starts. On some Windows environments an unrelated package named ``ee`` can be
installed alongside ``earthengine-api`` and overwrite the real
``site-packages/ee/__init__.py`` entrypoint. The rest of the Earth Engine
modules are still present, but ``import ee`` resolves to the wrong package and
fails on ``_curses``.

This shim restores the public Earth Engine entrypoint while reusing the actual
``earthengine-api`` modules already installed in the virtual environment.
"""

from __future__ import annotations

import inspect
import re
import sys
from importlib import metadata
from pathlib import Path
from typing import Any

from google.oauth2 import service_account


_PACKAGE_DIR = Path(__file__).resolve().parent


def _extend_package_path() -> None:
    """Add the real ``site-packages/ee`` directory to this package path."""
    for entry in map(Path, sys.path):
        candidate = entry / "ee"
        if candidate.resolve() == _PACKAGE_DIR:
            continue
        if (candidate / "data.py").is_file():
            candidate_str = str(candidate)
            if candidate_str not in __path__:
                __path__.append(candidate_str)
            return
    raise ImportError(
        "Unable to locate earthengine-api modules in site-packages. "
        "Install `earthengine-api` in the spatial virtual environment."
    )


_extend_package_path()

try:
    __version__ = metadata.version("earthengine-api")
except metadata.PackageNotFoundError:
    __version__ = "0.0.0"


from ee import _utils  # noqa: E402
from ee import batch  # noqa: E402
from ee import data  # noqa: E402
from ee import deprecation  # noqa: E402
from ee import deserializer  # noqa: E402
from ee import ee_types as types  # noqa: E402
from ee import oauth  # noqa: E402
from ._helpers import apply  # noqa: E402  # pylint: disable=redefined-builtin
from ._helpers import call  # noqa: E402
from ._helpers import profilePrinting  # noqa: E402
from ._helpers import ServiceAccountCredentials  # noqa: E402
from .apifunction import ApiFunction  # noqa: E402
from .blob import Blob  # noqa: E402
from .classifier import Classifier  # noqa: E402
from .clusterer import Clusterer  # noqa: E402
from .collection import Collection  # noqa: E402
from .computedobject import ComputedObject  # noqa: E402
from .confusionmatrix import ConfusionMatrix  # noqa: E402
from .customfunction import CustomFunction  # noqa: E402
from .daterange import DateRange  # noqa: E402
from .dictionary import Dictionary  # noqa: E402
from .ee_array import Array  # noqa: E402
from .ee_date import Date  # noqa: E402
from .ee_exception import EEException  # noqa: E402
from .ee_list import List  # noqa: E402
from .ee_number import Number  # noqa: E402
from .ee_string import String  # noqa: E402
from .element import Element  # noqa: E402
from .encodable import Encodable  # noqa: E402
from .errormargin import ErrorMargin  # noqa: E402
from .feature import Feature  # noqa: E402
from .featurecollection import FeatureCollection  # noqa: E402
from .filter import Filter  # noqa: E402
from .function import Function  # noqa: E402
from .geometry import Geometry  # noqa: E402
from .image import Image  # noqa: E402
from .imagecollection import ImageCollection  # noqa: E402
from .join import Join  # noqa: E402
from .kernel import Kernel  # noqa: E402
from .model import Model  # noqa: E402
from .pixeltype import PixelType  # noqa: E402
from .projection import Projection  # noqa: E402
from .reducer import Reducer  # noqa: E402
from .serializer import Serializer  # noqa: E402
from .terrain import Terrain  # noqa: E402


_HAS_DYNAMIC_ATTRIBUTES = True
NO_PROJECT_EXCEPTION = (
    "ee.Initialize: no project found. Call with project= or see "
    "http://goo.gle/ee-auth."
)


class _AlgorithmsContainer(dict):
    """Dictionary that also supports dot access."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value

    def __delattr__(self, name: str) -> None:
        del self[name]


Algorithms = _AlgorithmsContainer()

_DYNAMIC_CLASSES = [
    Element,
    Collection,
    Array,
    Blob,
    Classifier,
    Clusterer,
    ConfusionMatrix,
    Date,
    DateRange,
    Dictionary,
    ErrorMargin,
    Feature,
    FeatureCollection,
    Filter,
    Geometry,
    Image,
    ImageCollection,
    Join,
    Kernel,
    List,
    Model,
    Number,
    PixelType,
    Projection,
    Reducer,
    String,
    Terrain,
]


def Authenticate(
    authorization_code: str | None = None,
    quiet: bool | None = None,
    code_verifier: str | None = None,
    auth_mode: str | None = None,
    scopes: Any | None = None,
    force: bool = False,
) -> bool | None:
    return oauth.authenticate(
        authorization_code, quiet, code_verifier, auth_mode, scopes, force
    )


def _project_from_credentials(credentials: Any | None) -> str | int | None:
    """Resolve a project from credentials across EE client versions."""
    if credentials is None:
        return None

    quota_project_id = getattr(credentials, "quota_project_id", None)
    if quota_project_id:
        return quota_project_id

    project_id = getattr(credentials, "project_id", None)
    if project_id:
        return project_id

    resolver = getattr(oauth, "project_number_from_credentials", None)
    if callable(resolver):
        return resolver(credentials)

    client_id = getattr(credentials, "client_id", None)
    client_id_resolver = getattr(oauth, "_project_number_from_client_id", None)
    if callable(client_id_resolver):
        return client_id_resolver(client_id)

    return None


@_utils.accept_opt_prefix("opt_url")
def Initialize(
    credentials: Any | None = "persistent",
    url: str | None = None,
    cloud_api_key: str | None = None,
    http_transport: Any | None = None,
    project: str | int | None = None,
) -> None:
    """Initialize the Earth Engine client library."""
    if credentials == "persistent":
        credentials = data.get_persistent_credentials()

    if not project:
        project = _project_from_credentials(credentials)

    project = project or None
    is_valid_project = project and not oauth.is_sdk_project(project)
    empty_project_ok = isinstance(credentials, service_account.Credentials)
    if not is_valid_project and not empty_project_ok:
        raise EEException(NO_PROJECT_EXCEPTION)

    data.initialize(
        credentials=credentials,
        api_base_url=(url + "/api" if url else None),
        tile_base_url=url,
        cloud_api_base_url=url,
        cloud_api_key=cloud_api_key,
        project=project,
        http_transport=http_transport,
    )

    try:
        ApiFunction.initialize()
    except EEException as exc:
        adc_err = "authenticating by using local Application Default Credentials"
        api_err = "Earth Engine API has not been used in project ([0-9]+) before"
        matches = re.search(api_err, str(exc))
        oauth_project = "517222506229"
        oauth_project_err = (
            "Caller does not have required permission to use project "
            + oauth_project
        )
        if (
            adc_err in str(exc)
            or (matches and oauth.is_sdk_project(matches[1]))
            or (oauth_project_err in str(exc))
        ):
            raise EEException(NO_PROJECT_EXCEPTION) from None
        raise

    for dynamic_class in _DYNAMIC_CLASSES:
        dynamic_class.initialize()


def Reset() -> None:
    """Reset Earth Engine state for the current process."""
    global Algorithms
    data.reset()
    deprecation.Reset()
    ApiFunction.reset()
    for dynamic_class in _DYNAMIC_CLASSES:
        dynamic_class.reset()
    Algorithms = _AlgorithmsContainer()


def _Promote(arg: Any | None, a_class: str) -> Any | None:
    """Promote values to the Earth Engine types expected by API functions."""
    if arg is None:
        return arg

    if a_class == "Image":
        return Image(arg)
    if a_class == "Feature":
        if isinstance(arg, Collection):
            return ApiFunction.call_(
                "Feature", ApiFunction.call_("Collection.geometry", arg)
            )
        return Feature(arg)
    if a_class == "Element":
        if isinstance(arg, Element):
            return arg
        if isinstance(arg, Geometry):
            return Feature(arg)
        if isinstance(arg, ComputedObject):
            return Element(arg.func, arg.args, arg.varName)
        raise EEException(f"Cannot convert {arg} to Element.")
    if a_class == "Geometry":
        if isinstance(arg, Collection):
            return ApiFunction.call_("Collection.geometry", arg)
        return Geometry(arg)
    if a_class in ("FeatureCollection", "Collection"):
        if isinstance(arg, Collection):
            return arg
        return FeatureCollection(arg)
    if a_class == "ImageCollection":
        return ImageCollection(arg)
    if a_class == "Filter":
        return Filter(arg)
    if a_class == "Algorithm":
        if isinstance(arg, str):
            return ApiFunction.lookup(arg)
        if callable(arg):
            args_count = len(inspect.getfullargspec(arg).args)
            return CustomFunction.create(arg, "Object", ["Object"] * args_count)
        if isinstance(arg, Encodable):
            return arg
        raise EEException(f"Argument is not a function: {arg}")
    if a_class == "Dictionary":
        if isinstance(arg, dict):
            return arg
        return Dictionary(arg)
    if a_class == "String":
        if types.isString(arg) or isinstance(arg, (ComputedObject, String)):
            return String(arg)
        return arg
    if a_class == "List":
        return List(arg)
    if a_class in ("Number", "Float", "Long", "Integer", "Short", "Byte"):
        return Number(arg)
    if a_class in globals():
        cls = globals()[a_class]
        ctor = ApiFunction.lookupInternal(a_class)
        if isinstance(arg, cls):
            return arg
        if ctor:
            return cls(arg)
        if isinstance(arg, str):
            if hasattr(cls, arg):
                return getattr(cls, arg)()
            raise EEException(f"Unknown algorithm: {a_class}.{arg}")
        return cls(arg)
    return arg


types._registerClasses(globals())  # pylint: disable=protected-access
Function._registerPromoter(_Promote)  # pylint: disable=protected-access
