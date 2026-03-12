# Installation

## From PyPI

```bash
pip install airqoair
```

## From the Monorepo

```bash
cd packages/airqoair
pip install -e ".[dev]"
```

## Docs Dependencies

To build the documentation site locally:

```bash
cd packages/airqoair
pip install -e ".[docs]"
mkdocs serve
```

The site configuration lives in [`mkdocs.yml`](../mkdocs.yml).

## Recommended local workflow

For package work:

```bash
cd packages/airqoair
pip install -e ".[dev]"
python -m pytest tests
```

For documentation work:

```bash
cd packages/airqoair
pip install -e ".[docs]"
mkdocs serve
```
