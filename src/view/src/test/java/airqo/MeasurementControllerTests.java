package airqo;

import airqo.models.Frequency;
import airqo.models.GraphInsight;
import airqo.models.Insight;
import airqo.models.InsightData;
import airqo.services.InsightsService;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.AutoConfigureDataMongo;
import org.springframework.boot.test.autoconfigure.restdocs.AutoConfigureRestDocs;
import org.springframework.boot.test.autoconfigure.restdocs.RestDocsMockMvcConfigurationCustomizer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.restdocs.operation.preprocess.Preprocessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

import static airqo.config.Constants.dateTimeFormat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.restdocs.request.RequestDocumentation.parameterWithName;
import static org.springframework.restdocs.request.RequestDocumentation.requestParameters;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Slf4j
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@AutoConfigureRestDocs(uriHost = "api.airqo.net", uriScheme = "https", uriPort = 443)
@AutoConfigureDataMongo
public class MeasurementControllerTests {

	private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
	@Autowired
	protected MockMvc mockMvc;
	@MockBean
	InsightsService insightsService;
	String startDateTimeStr = "";
	String endDateTimeStr = "";
	Date startDateTime;
	Date endDateTime;
	String v1UrlTemplate = "";
	String v2UrlTemplate = "";
	String siteIds = "";
	List<String> siteIdsList = new ArrayList<>();
	List<Insight> insights = new ArrayList<>();

	InsightData insightData;

	@BeforeEach
	public void initialize() {

		HashMap<String, Date> queryDates = Utils.getInsightsQueryDates();
		startDateTime = queryDates.get("startDateTime");
		endDateTime = queryDates.get("endDateTime");
		startDateTimeStr = simpleDateFormat.format(startDateTime);
		endDateTimeStr = simpleDateFormat.format(endDateTime);
		v1UrlTemplate = "/measurements/app/insights";
		v2UrlTemplate = "/measurements/mobile-app/insights";
		siteIds = "site-01,site-02";
		siteIdsList = Arrays.stream(siteIds.split(",")).toList();
		insights = siteIdsList.stream().map(site -> {
			Insight insight = new Insight();
			insight.setSiteId(site);
			insight.setId(site);
			insight.setEmpty(false);
			insight.setForecast(false);
			insight.setFrequency(Frequency.HOURLY);
			insight.setPm2_5(24);
			insight.setPm10(50);
			insight.setTime(new Date());
			return insight;
		}).collect(Collectors.toList());

		List<GraphInsight> forecast = siteIdsList.stream().map(site -> {
			GraphInsight insight = new GraphInsight();
			insight.setSiteId(site);
			insight.setAvailable(true);
			insight.setForecast(true);
			insight.setFrequency(Frequency.HOURLY);
			insight.setPm2_5(24);
			insight.setPm10(50);
			insight.setTime(new Date());
			return insight;
		}).toList();
		List<GraphInsight> historical = siteIdsList.stream().map(site -> {
			GraphInsight insight = new GraphInsight();
			insight.setSiteId(site);
			insight.setAvailable(true);
			insight.setForecast(false);
			insight.setFrequency(Frequency.DAILY);
			insight.setPm2_5(24);
			insight.setPm10(50);
			insight.setTime(new Date());
			return insight;
		}).toList();

		insightData = new InsightData(forecast, historical);
	}

	@Test
	@DisplayName("Testing date query query parameters")
	public void dateQueryParameters() {
		Assertions.assertEquals(new DateTime(startDateTime).getDayOfWeek(), 1);
		Assertions.assertEquals(new DateTime(endDateTime).getDayOfWeek(), 7);
	}

	@Test
	@DisplayName("Testing app insights V1 API query parameters")
	public void testAppInsightsV1QueryParameters() throws Exception {

		// Testing start date parameter
		this.mockMvc.perform(get(v1UrlTemplate)
				.param("endDateTime", endDateTimeStr)
				.param("siteId", siteIds))
			.andExpect(status().isBadRequest());

		// Testing end date parameter
		this.mockMvc.perform(get(v1UrlTemplate)
				.param("startDateTime", startDateTimeStr)
				.param("siteId", siteIds))
			.andExpect(status().isBadRequest());

		// Testing site id parameter
		this.mockMvc.perform(get(v1UrlTemplate)
				.param("startDateTime", startDateTimeStr)
				.param("endDateTime", endDateTimeStr))
			.andExpect(status().isBadRequest());

		List<Insight> insights = siteIdsList.stream().map(site -> {
			Insight insight = new Insight();
			insight.setSiteId(site);
			insight.setId(site);
			insight.setEmpty(false);
			insight.setForecast(false);
			insight.setFrequency(Frequency.HOURLY);
			insight.setPm2_5(24);
			insight.setPm10(50);
			insight.setTime(new Date());
			return insight;
		}).collect(Collectors.toList());

		when(insightsService.getInsights(startDateTime, endDateTime, siteIdsList)).thenReturn(insights);

		// Testing all parameters
		ResultActions resultActions = this.mockMvc.perform(get(v1UrlTemplate)
				.param("siteId", siteIds)
				.param("startDateTime", startDateTimeStr)
				.param("endDateTime", endDateTimeStr))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Operation Successful")))
			.andExpect(jsonPath("$.data").isArray())
			.andExpect(jsonPath("$.data", hasSize(2)));
		verify(this.insightsService, times(1)).getInsights(startDateTime, endDateTime, siteIdsList);

		MockHttpServletResponse response = resultActions.andReturn().getResponse();
		Assertions.assertEquals(response.getStatus(), 200);

	}

	@Test
	@DisplayName("Testing app insights V2 API query parameters")
	public void testAppInsightsV2QueryParameters() throws Exception {

		String siteId = Arrays.stream(siteIds.split(",")).toList().get(0);

		HashMap<String, Date> params = Utils.getInsightsQueryDates();

		// Testing start date parameter
		when(insightsService.getInsights(params.get("startDateTime"), params.get("endDateTime"), siteId, 0)).thenReturn(insightData);

		this.mockMvc.perform(get(v2UrlTemplate)
				.param("endDateTime", endDateTimeStr)
				.param("siteId", siteId))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON));

		// Testing end date parameter
		when(insightsService.getInsights(params.get("startDateTime"), params.get("endDateTime"), siteId, 0)).thenReturn(insightData);

		this.mockMvc.perform(get(v2UrlTemplate)
				.param("startDateTime", startDateTimeStr)
				.param("siteId", siteId))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON));

		// Testing utc offset, start date and end date parameters
		when(insightsService.getInsights(startDateTime, endDateTime, siteId, 1)).thenReturn(insightData);

		this.mockMvc.perform(get(v2UrlTemplate)
				.param("startDateTime", startDateTimeStr)
				.param("endDateTime", endDateTimeStr)
				.param("utcOffset", "1")
				.param("siteId", siteId))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON));

		// Testing site id parameter
		this.mockMvc.perform(get(v2UrlTemplate)
				.param("startDateTime", startDateTimeStr)
				.param("endDateTime", endDateTimeStr))
			.andExpect(status().isBadRequest());

	}

	@Test
	@DisplayName("App Insights V1 API Documentation")
	public void shouldGenerateAppInsightsV1APIDocs() throws Exception {

		when(insightsService.getInsights(startDateTime, endDateTime, siteIdsList)).thenReturn(insights);

		this.mockMvc.perform(get("/api/v1/view/measurements/app/insights")
				.contextPath("/api/v1/view")
				.header("Authorization", "Token my-jwt-token")
				.param("siteId", siteIds)
				.param("startDateTime", startDateTimeStr)
				.param("endDateTime", endDateTimeStr))
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("app-insights",
				requestParameters(
					parameterWithName("siteId").description("Site id(s). Separate multiple site ids using commas").optional(),
					parameterWithName("startDateTime").description("Start date time. Format `yyyy-MM-ddTHH:mm:ssZ` . Timezone is UTC").optional(),
					parameterWithName("endDateTime").description("End date time. Format `yyyy-MM-ddTHH:mm:ssZ` . Timezone is UTC").optional()
				)
			));
	}

	@TestConfiguration
	static class RestDocsConfiguration {

		@Bean
		public RestDocsMockMvcConfigurationCustomizer restDocsMockMvcConfigurationCustomizer() {
			return configurer -> configurer.operationPreprocessors()
				.withRequestDefaults(Preprocessors.prettyPrint())
				.withResponseDefaults(Preprocessors.prettyPrint());
		}
	}
}
