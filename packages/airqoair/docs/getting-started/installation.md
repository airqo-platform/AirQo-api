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
python -m mkdocs serve
```

The site configuration lives in `packages/airqoair/mkdocs.yml`.

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
python -m mkdocs serve
```

## GitHub Pages deployment

To build the site locally without publishing it:

```bash
cd packages/airqoair
python scripts/deploy_docs.py --build-only
```

To publish the documentation from the package root to the `gh-pages` branch:

```bash
cd packages/airqoair
python scripts/deploy_docs.py --site-url https://airqoair-project.github.io/book/
```

This command uses `mkdocs gh-deploy`, so GitHub Pages must be configured to serve from the `gh-pages` branch.

If the final public URL differs from `https://airqoair-project.github.io/book/`, pass the correct URL with `--site-url`.
