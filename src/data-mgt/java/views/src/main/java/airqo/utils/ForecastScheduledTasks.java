package airqo.utils;

import airqo.models.Device;
import airqo.models.Forecast;
import airqo.models.Tenant;
import airqo.services.DeviceService;
import airqo.services.MeasurementService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static airqo.models.Forecast.Forecasts.refactorRecords;

@Profile({"forecast-jobs-dev", "forecast-jobs-staging", "forecast-jobs-production"})
@Component
public class ForecastScheduledTasks {

	private static final Logger logger = LoggerFactory.getLogger(ForecastScheduledTasks.class);

	@Autowired
	MeasurementService measurementService;

	@Autowired
	DeviceService deviceService;

	@Value("${airqo.api}")
	private String airQoBaseUrl;

	@Scheduled(cron = "${airqo.forecast.data.cronSpec}")
	public void fetchForecastData() {
		try {

			List<Device> devices = deviceService.getDevices(Tenant.AIRQO);
			List<Forecast> forecastList = new ArrayList<>();

			long time = Instant.now().getEpochSecond();
			String baseUrl = airQoBaseUrl.replaceFirst("v1", "v2");
			baseUrl = baseUrl + "predict/";

			HttpClient httpClient = HttpClient.newBuilder()
				.build();
			ObjectMapper objectMapper = new ObjectMapper();

			for (Device device : devices) {
				try {
					String url = baseUrl + device.getDeviceNumber() + "/" + time;
					logger.info(url);

					HttpRequest request = HttpRequest.newBuilder()
						.GET()
						.uri(URI.create(url))
						.setHeader("Accept", "application/json")
						.build();

					HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
					Forecast.Forecasts forecasts = objectMapper.readValue(httpResponse.body(), Forecast.Forecasts.class);
					List<Forecast> cleanedForecasts = refactorRecords(forecasts.getPredictions(), device);
					forecastList.addAll(cleanedForecasts);

				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			logger.info(String.valueOf(forecastList.size()));
			measurementService.insertForecast(forecastList);
		} catch (RestClientException e) {
			e.printStackTrace();
		}
	}

}
