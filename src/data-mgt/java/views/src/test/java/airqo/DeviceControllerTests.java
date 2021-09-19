package airqo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.restdocs.AutoConfigureRestDocs;
import org.springframework.boot.test.autoconfigure.restdocs.RestDocsMockMvcConfigurationCustomizer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.restdocs.operation.preprocess.Preprocessors;
import org.springframework.restdocs.snippet.Attributes;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.restdocs.payload.PayloadDocumentation.responseFields;
import static org.springframework.restdocs.request.RequestDocumentation.parameterWithName;
import static org.springframework.restdocs.request.RequestDocumentation.requestParameters;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureRestDocs(uriHost = "api.airqo.net/v1/api/views", uriScheme = "https", uriPort = 443)
public class DeviceControllerTests {

	@Autowired
	protected MockMvc mockMvc;

	@Test
	public void shouldReturnDevices() throws Exception {
		this.mockMvc.perform(get("/devices").accept(MediaType.APPLICATION_JSON))
			.andDo(print())
			.andExpect(status().isOk())
			.andDo(document("devices",
				responseFields(
					fieldWithPath("pageNumber").description("Page number"),
					fieldWithPath("pageSize").description("Maximum number of devices per page"),
					fieldWithPath("elementsOnPage").description("Number of devices on the content field of the current page"),
					fieldWithPath("isFirstPage").description("True if it's the first page else False"),
					fieldWithPath("isLastPage").description("True if it's the last page else False"),
					fieldWithPath("hasNextPage").description("True if there is a preceding page else False"),
					fieldWithPath("hasPreviousPage").description("True if there is a processor page else False"),
					fieldWithPath("totalPages").description("total number of pages"),
					fieldWithPath("totalElements").description("Total number of devices"),
					fieldWithPath("offset").description("Offset value"),
					fieldWithPath("content").description("Devices on the current page")),
				requestParameters(
					parameterWithName("page").description("Page number")
						.attributes(Attributes.key("0").value("")).optional(),
					parameterWithName("size").description("Number of elements on each page").optional(),
					parameterWithName("sort").description("Field to perform sorting on").optional()
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
