package airqo.utils;

import airqo.models.Device;
import airqo.models.Site;
import airqo.models.Tenant;
import airqo.services.DeviceService;
import airqo.services.SiteService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;


@Profile({"metadata-job"})
@Component
public class MetaDataScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(MetaDataScheduledTasks.class);
	@Autowired
	SiteService siteService;
	@Autowired
	DeviceService deviceService;
	@Autowired
	private ApplicationContext context;
	@Value("${airQoApi}")
	private String airQoBaseUrl;

	@PostConstruct
	public void getSitesAndDevices() {
		logger.info("getting devices");
		getSites();
		getDevices();
		logger.info("exiting");
		int exitCode = SpringApplication.exit(context, () -> 0);
		System.exit(exitCode);
	}

	public void getSites() {

		try {
			RestTemplate restTemplate = new RestTemplate();

			Site.SiteList airqoSites = restTemplate.getForObject(
				String.format("%s/devices/sites?tenant=airqo", airQoBaseUrl), Site.SiteList.class);

			if (airqoSites != null) {
				logger.info(airqoSites.toString());
				siteService.insertSites(airqoSites.getSites(), Tenant.AIRQO);
			}

			Site.SiteList kccaSites = restTemplate.getForObject(
				String.format("%s/devices/sites?tenant=kcca", airQoBaseUrl), Site.SiteList.class);

			if (kccaSites != null) {
				logger.info(kccaSites.toString());
				siteService.insertSites(kccaSites.getSites(), Tenant.KCCA);
			}

		} catch (RestClientException e) {
			e.printStackTrace();
		}

	}

	public void getDevices() {

		try {
			RestTemplate restTemplate = new RestTemplate();

			// AirQo
			Device.DeviceList airqoDevices = restTemplate.getForObject(
				String.format("%s/devices?tenant=airqo", airQoBaseUrl), Device.DeviceList.class);
			if (airqoDevices != null) {
				logger.info(airqoDevices.toString());
				deviceService.insertDevices(airqoDevices.getDevices(), Tenant.AIRQO);
			}

			// Kcca
			Device.DeviceList kccaDevices = restTemplate.getForObject(
				String.format("%s/devices?tenant=kcca", airQoBaseUrl), Device.DeviceList.class);

			if (kccaDevices != null) {
				logger.info(kccaDevices.toString());
				deviceService.insertDevices(kccaDevices.getDevices(), Tenant.KCCA);
			}

		} catch (RestClientException e) {
			e.printStackTrace();
		}

	}
}
