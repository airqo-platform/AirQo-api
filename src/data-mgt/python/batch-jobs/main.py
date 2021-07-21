from airqo_batch_fetch import AirQoBatchFetch
from config import configuration
from kcca_batch_fetch import KccaBatchFetch

if __name__ == "__main__":

    tenant = configuration.TENANT
    if not tenant:
        print("Tenant not specified")
        exit()

    if tenant.strip().lower() == "airqo":
        airqo_fetch = AirQoBatchFetch()
        airqo_fetch.begin_fetch()
    elif tenant.strip().lower() == "kcca":
        kcca_fetch = KccaBatchFetch()
        kcca_fetch.begin_fetch()
    else:
        print("Invalid Tenant")
