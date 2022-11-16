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
	@DisplayName("App Insights API Documentation")
	public void shouldGenerateAppInsightsAPIDocs() throws Exception {

		insights.clear();
		Date startDateTime = simpleDateFormat.parse("2022-01-01T10:00:00Z");
		Date endDateTime = simpleDateFormat.parse("2022-01-01T17:00:00Z");
		String siteIds = "site-01,site-02";

		Insight insight = new Insight();
		insight.setTime(startDateTime);
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(false);
		insight.setPm2_5(23.90332);
		insight.setPm10(34.54333);
		insight.setSiteId("site-01");
		insights.add(insight);

		insight = new Insight();
		insight.setTime(endDateTime);
		insight.setFrequency(Frequency.HOURLY);
		insight.setEmpty(false);
		insight.setForecast(true);
		insight.setPm2_5(45.2323);
		insight.setPm10(52.3444);
		insight.setSiteId("site-02");
		insights.add(insight);

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.siteId
			.in(siteIds.split(","))
			.and(qInsight.time.goe(startDateTime))
			.and(qInsight.time.loe(endDateTime))
			.and(qInsight.frequency.eq(Frequency.HOURLY));

		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/api/v1/view/measurements/app/insights")
				.contextPath("/api/v1/view")
				.header("Authorization", "Token my-jwt-token")
				.param("siteId", siteIds)
				.param("startDateTime", simpleDateFormat.format(startDateTime))
				.param("endDateTime", simpleDateFormat.format(endDateTime))
				.param("frequency", "hourly"))
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("app-insights",
				requestParameters(
					parameterWithName("siteId").description("Site id(s). Separate multiple site ids using commas").optional(),
					parameterWithName("startDateTime").description("Start date time. Format `yyyy-MM-ddTHH:mm:ssZ` . Timezone is UTC").optional(),
					parameterWithName("endDateTime").description("End date time. Format `yyyy-MM-ddTHH:mm:ssZ` . Timezone is UTC").optional(),
					parameterWithName("frequency").description("Either *hourly* or *daily*").optional(),
					parameterWithName("forecast").description("Return Forecast insights").optional(),
					parameterWithName("empty").description("Return empty insights").optional()
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
