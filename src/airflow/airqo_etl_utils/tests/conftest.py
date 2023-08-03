def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "bq_test: mark a test as a bigquery class method"
    )
