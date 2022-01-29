package airqo;

import airqo.models.Frequency;
import airqo.models.Insight;
import airqo.services.MeasurementService;
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


//@Profile({"api"})
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
	Date startTime = new Date();
	Date endTime = new Date();
	String siteId = "";

	//	@Test
	public void shouldReturnInsights() throws Exception {

		when(measurementService.getInsights(Frequency.HOURLY, startTime, endTime, siteId)).thenReturn(insights);

		this.mockMvc.perform(get("/measurements/insights")
				.param("startTime", simpleDateFormat.format(startTime))
				.param("endTime", simpleDateFormat.format(endTime))
				.param("siteId", siteId)
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
