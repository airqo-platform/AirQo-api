import pytest


@pytest.fixture
def monkeypatch():
    mpatch = pytest.MonkeyPatch()
    yield mpatch
    mpatch.undo()
