package airqo;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.models.QInsight;
import airqo.services.MeasurementService;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
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
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

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
	MeasurementService measurementService;

	List<Insight> insights = new ArrayList<>();

	@BeforeEach
	public void initialize() {

	}

	@Test
	@DisplayName("Testing app insights query parameters")
	public void testAppInsightsQueryParameters() throws Exception {
		Insight insight = new Insight();

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.eq(Frequency.HOURLY);


		// Testing Hourly Frequency parameter
		insight.setFrequency(Frequency.HOURLY);
		insights.clear();
		insights.add(insight);
		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/measurements/app/insights")
				.param("frequency", "hourly"))
			.andExpect(status().isOk())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Operation Successful")))
			.andExpect(jsonPath("$.data").isArray())
			.andExpect(jsonPath("$.data", hasSize(1)))
			.andExpect(jsonPath("$.data[0].frequency", is("HOURLY")));
		verify(this.measurementService, times(1)).apiGetInsights(predicate);


		// Testing siteId parameter
		insight = new Insight();
		insight.setSiteId("site-01");
		predicate = qInsight.siteId.eq("site-01");
		insights.clear();
		insights.add(insight);
		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/measurements/app/insights")
				.param("siteId", "site-01"))
			.andExpect(status().isOk())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Operation Successful")))
			.andExpect(jsonPath("$.data").isArray())
			.andExpect(jsonPath("$.data", hasSize(1)))
			.andExpect(jsonPath("$.data[0].siteId", is("site-01")));
		verify(this.measurementService, times(1)).apiGetInsights(predicate);

		insight = new Insight();
		insight.setSiteId("site-02");
		insights.add(insight);

		predicate = qInsight.siteId.in("site-01,site-02".split(","));
		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		ResultActions resultActions = this.mockMvc.perform(get("/measurements/app/insights")
				.param("siteId", "site-01,site-02"))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Operation Successful")))
			.andExpect(jsonPath("$.data").isArray())
			.andExpect(jsonPath("$.data", hasSize(2)));
		verify(this.measurementService, times(1)).apiGetInsights(predicate);

		MockHttpServletResponse response = resultActions.andReturn().getResponse();
		Assertions.assertEquals(response.getStatus(), 200);

	}

	@Test
	@DisplayName("Testing insights query parameters")
	public void testInsightsQueryParameters() throws Exception {


		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("endTime", "2022-01-28T00:00:00Z")
				.param("startTime", "2022-01-27T00:00:00Z")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Missing request parameter")));

		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("siteId", "617bc2162ea2ed001fc1ad20")
				.param("startTime", "2022-01-27T00:00:00Z")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Missing request parameter")));

		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("endTime", "2022-01-28T00:00:00Z")
				.param("siteId", "617bc2162ea2ed001fc1ad20")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Missing request parameter")));


		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("frequency", "hourly")
				.param("endTime", "2022-01-28T00:00:00Z")
				.param("siteId", "617bc2162ea2ed001fc1ad20")
				.param("startTime", "2022-01-29T00:00:00Z")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Invalid Datetime values")));

		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("frequency", "hourly")
				.param("endTime", "2022-01-28sT00:00:00Z")
				.param("siteId", "617bc2162ea2ed001fc1ad20")
				.param("startTime", "2022-01-29T00:00:00Z")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Invalid Datetime values")));

		this.mockMvc.perform(get("/api/v1/views/measurements/insights").contextPath("/api/v1/views")
				.param("frequency", "hourly")
				.param("endTime", "2022-01-28T00:00:00Z")
				.param("siteId", "617bc2162ea2ed001fc1ad20")
				.param("startTime", "2022-01-29gT00:00:00Z")
			)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.message", is("Invalid Datetime values")));
	}

	@Test
	@DisplayName("App Insights API Documentation")
	public void shouldGenerateAppInsightsAPIDocs() throws Exception {

		insights.clear();

		Insight insight = new Insight();
		insight.setTime(simpleDateFormat.parse("2022-01-01T00:00:00Z"));
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(false);
		insight.setPm2_5(23.90332);
		insight.setPm10(34.54333);
		insight.setSiteId("site-01");
		insights.add(insight);

		insight = new Insight();
		insight.setTime(simpleDateFormat.parse("2022-01-01T01:00:00Z"));
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(true);
		insight.setPm2_5(45.2323);
		insight.setPm10(52.3444);
		insight.setSiteId("site-01");
		insights.add(insight);

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.siteId
			.in("site-01,site-02".split(","))
			.and(qInsight.frequency.eq(Frequency.HOURLY));

		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/api/v1/view/measurements/app/insights")
				.contextPath("/api/v1/view")
				.header("Authorization", "Token my-jwt-token")
				.param("siteId", "site-01,site-02")
				.param("frequency", "hourly"))
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("app-insights",
				requestParameters(
					parameterWithName("siteId").description("Site id(s). Separate multiple site ids using commas").optional(),
					parameterWithName("time").description("Start time. If another query parameter is specified. One is considered the start time and the other the end time depending on logical order").optional(),
					parameterWithName("frequency").description("Either *hourly* or *daily*").optional(),
					parameterWithName("forecast").description("Return Forecast insights").optional(),
					parameterWithName("empty").description("Return empty insights").optional()
				)));
	}

	@Test
	@DisplayName("Insights API Documentation")
	public void shouldGenerateInsightsAPIDocs() throws Exception {

		insights.clear();

		Date startTime = new Date();

		Calendar c = Calendar.getInstance();
		c.setTime(startTime);
		c.add(Calendar.HOUR, 1);
		Date endTime = c.getTime();

		Insight insight = new Insight();
		insight.setTime(startTime);
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(false);
		insight.setPm2_5(23.90332);
		insight.setPm10(34.54333);
		insight.setSiteId("site-01");
		insights.add(insight);

		insight = new Insight();
		insight.setTime(endTime);
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(true);
		insight.setPm2_5(45.2323);
		insight.setPm10(52.3444);
		insight.setSiteId("site-01,site-01");
		insights.add(insight);

		Frequency frequency = Frequency.HOURLY;
		List<String> siteIds = new ArrayList<>();
		siteIds.add("site-01");
		siteIds.add("site-02");


		when(measurementService.getInsights(frequency, startTime, endTime, siteIds)).thenReturn(insights);

		this.mockMvc.perform(get("/api/v1/views/measurements/insights")
				.contextPath("/api/v1/views")
				.header("Authorization", "Token my-jwt-token")
				.param("frequency", "hourly")
				.param("endTime", simpleDateFormat.format(endTime))
				.param("siteId", "site-01,site-02")
				.param("startTime", simpleDateFormat.format(startTime))
			)
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("insights",
				requestParameters(
					parameterWithName("siteId").description("Site id(s). Separate multiple site ids using commas"),
					parameterWithName("startTime").description("Start time."),
					parameterWithName("endTime").description("Start time."),
					parameterWithName("frequency").description("Optional. Either *hourly* or *daily*").optional()
				)));
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
