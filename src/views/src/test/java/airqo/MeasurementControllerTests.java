package airqo;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.models.QInsight;
import airqo.services.MeasurementService;
import com.querydsl.core.types.Predicate;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.restdocs.AutoConfigureRestDocs;
import org.springframework.boot.test.autoconfigure.restdocs.RestDocsMockMvcConfigurationCustomizer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.restdocs.operation.preprocess.Preprocessors;
import org.springframework.test.web.servlet.MockMvc;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static airqo.config.Constants.dateTimeFormat;
import static org.mockito.Mockito.when;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@AutoConfigureRestDocs(uriHost = "api.airqo.net/v1/views", uriScheme = "https", uriPort = 443)
public class MeasurementControllerTests {

	private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat(dateTimeFormat);
	@Autowired
	protected MockMvc mockMvc;
	@MockBean
	MeasurementService measurementService;

	List<Insight> insights = new ArrayList<>();
	private Date startTime = new Date();
	private Date endTime = new Date();
	private List<String> siteIds = new ArrayList<>();
	private boolean empty;
	private boolean forecast;
	private String frequency;

	@BeforeEach
	public void initialize(){
		startTime = new Date();
		endTime = new Date();
		siteIds = new ArrayList<>();
		frequency = "";
	}

	public void shouldReturnHourlyInsights() throws Exception {

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.eq(Frequency.HOURLY);

		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/measurements/app/insights")
				.param("frequency", "HOURLY")
				.contentType(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	public void shouldReturnInsights() throws Exception {

		QInsight qInsight = QInsight.insight;
		Predicate predicate = qInsight.frequency.eq(Frequency.DAILY)
			.and(qInsight.siteId.in(siteIds))
			.and(qInsight.time.goe(startTime))
			.and(qInsight.time.loe(endTime));

		when(measurementService.apiGetInsights(predicate)).thenReturn(insights);

		this.mockMvc.perform(get("/measurements/app/insights")
				.param("time", simpleDateFormat.format(startTime))
				.param("time", simpleDateFormat.format(endTime))
				.param("siteId", "site1,site2")
				.param("frequency", "hourly")
				.contentType(MediaType.APPLICATION_JSON))
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("data"));
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
