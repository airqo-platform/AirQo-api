package airqo.services;

import airqo.models.StoreVersion;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.spring.tracing.SentrySpan;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class AppService {

	@Value("${airqo.play-store.version}")
	String playStoreVersion;

	@SentrySpan
	public StoreVersion getAndroidVersion(String packageName) {
		StoreVersion storeVersion = new StoreVersion();
		storeVersion.setUrl("https://play.google.com/store/apps/details?id=" + packageName);
		storeVersion.setVersion(playStoreVersion);

		Document document;

		try {
			document = Jsoup.connect("https://play.google.com/store/apps/details?id=" + packageName + "&hl=en")
				.timeout(30000)
				.userAgent("Mozilla/5.0 (Windows; U; WindowsNT 5.1; en-US; rv1.8.1.6) Gecko/20070725 Firefox/2.0.0.6")
				.referrer("http://www.google.com")
				.get();
		} catch (IOException e) {
			return storeVersion;
		}
		String version;

		try {

			version = document.select(".hAyfc .htlgb")
				.get(7)
				.ownText();

			storeVersion.setVersion(version);

		} catch (Exception e) {
			log.error(e.getLocalizedMessage());
			try {
				Pattern versionPattern = Pattern.compile("(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)");

				for(Element element: document.getAllElements()){

					Matcher m = versionPattern.matcher(element.ownText());
					while (m.find()) {
						storeVersion.setVersion(m.group(1));
					}

					m = versionPattern.matcher(element.text());
					while (m.find()) {
						storeVersion.setVersion(m.group(1));
					}

					m = versionPattern.matcher(element.data());
					while (m.find()) {
						storeVersion.setVersion(m.group(1));
					}

					if (!storeVersion.getVersion().isEmpty()){
						break;
					}
				}

			} catch (Exception ex) {
				log.error(e.getLocalizedMessage());
			}
		}


		return storeVersion;
	}

	public StoreVersion getIOSVersion(String bundleId) {
		StoreVersion storeVersion = new StoreVersion();
		try {

			HttpClient httpClient = HttpClient.newBuilder()
				.build();

			HttpRequest request = HttpRequest.newBuilder()
				.GET()
				.uri(URI.create("https://itunes.apple.com/lookup?bundleId=" + bundleId))
				.setHeader("Accept", "application/text")
				.build();

			HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

			ObjectMapper objectMapper = new ObjectMapper();
			HashMap<String, Object> textBody = objectMapper.readValue(httpResponse.body(), new TypeReference<>() {
			});

			String version = ((HashMap<Object, Object>) ((List) textBody.get("results")).get(0)).get("version").toString();
			String url = ((HashMap<Object, Object>) ((List) textBody.get("results")).get(0)).get("trackViewUrl").toString();

			storeVersion.setVersion(version);
			storeVersion.setUrl(url);
		} catch (Exception e) {
			log.error(e.getLocalizedMessage());
		}

		return storeVersion;
	}
}
