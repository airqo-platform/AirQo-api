"""Prints the installed packages that only the Google provider requires.

The image installs the Google provider for remote task logs in Cloud Storage. The provider
requires many Google Cloud clients and other libraries that the service does not use. This
script reads the installed package metadata and follows each requirement, including the
extras that a requirement names, the way pip resolves them.

Usage:
    python google_provider_only_packages.py --requested REQUIREMENT ... --keep PACKAGE ...

--requested takes the requirements the image installs other than the Google provider, for
example "apache-airflow[celery,postgres,sentry]". --keep takes the packages the remote task
log handler imports. The output is a space-separated list of package names.
"""

import argparse
import importlib.metadata
import re

from packaging.markers import default_environment
from packaging.requirements import Requirement

GOOGLE_PROVIDER = "apache-airflow-providers-google"


def normalise(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def installed_packages() -> dict:
    return {
        normalise(dist.metadata["Name"]): dist
        for dist in importlib.metadata.distributions()
    }


def requirements_of(dist, extras: frozenset, environment: dict) -> list:
    """Returns (name, extras) for each requirement of dist that applies with the given extras."""
    applicable = []
    for line in dist.requires or []:
        requirement = Requirement(line)
        if requirement.marker and not any(
            requirement.marker.evaluate({**environment, "extra": extra})
            for extra in (extras or {""})
        ):
            continue
        applicable.append(
            (
                normalise(requirement.name),
                frozenset(normalise(extra) for extra in requirement.extras),
            )
        )
    return applicable


def closure(roots: list, packages: dict, environment: dict) -> set:
    """Returns the names of the installed packages that roots require, roots included."""
    extras_by_name: dict = {}
    pending = list(roots)
    while pending:
        name, extras = pending.pop()
        if name not in packages:
            continue
        known = extras_by_name.get(name)
        if known is not None and extras <= known:
            continue
        extras_by_name[name] = (known or frozenset()) | extras
        pending += requirements_of(
            packages[name], extras_by_name[name], environment
        )
    return set(extras_by_name)


def parse_root(text: str) -> tuple:
    requirement = Requirement(text)
    return (
        normalise(requirement.name),
        frozenset(normalise(extra) for extra in requirement.extras),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--requested", nargs="+", required=True)
    parser.add_argument("--keep", nargs="+", required=True)
    arguments = parser.parse_args()

    packages = installed_packages()
    environment = default_environment()
    requested = [parse_root(text) for text in arguments.requested]
    google = (normalise(GOOGLE_PROVIDER), frozenset())

    with_google = closure(requested + [google], packages, environment)
    without_google = closure(requested, packages, environment)
    kept = closure(
        [parse_root(text) for text in arguments.keep], packages, environment
    ) | {google[0]}
    print(" ".join(sorted(with_google - without_google - kept)))


if __name__ == "__main__":
    main()
