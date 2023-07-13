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
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class AppService {

	@Value("${airqo.play-store.version}")
	String playStoreVersion;

	@Value("${android-url}")
	private String androidUrl;

	@Value("${ios-url}")
	private String iOSUrl;

	@SentrySpan
	public StoreVersion getAndroidVersion(String packageName, String userVersion) {
		StoreVersion storeVersion = new StoreVersion();
		storeVersion.setVersion(playStoreVersion);
		storeVersion.setUrl(androidUrl);

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

		if(!userVersion.isEmpty()){
			List<Integer> userVersionParts = Arrays.stream(userVersion.split("\\.")).map(Integer::parseInt).toList();
			List<Integer> updatedVersionParts = Arrays.stream(storeVersion.getVersion().split("\\.")).map(Integer::parseInt).toList();
			boolean isUpdated = compareVersions(userVersionParts, updatedVersionParts);
			storeVersion.setIsUpdated(isUpdated);
		}

		return storeVersion;
	}

	public StoreVersion getIOSVersion(String bundleId, String userVersion) {
		StoreVersion storeVersion = new StoreVersion();
		storeVersion.setUrl(iOSUrl);

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

			storeVersion.setVersion(version);
		} catch (Exception e) {
			log.error(e.getLocalizedMessage());
		}

		if(!userVersion.isEmpty()){
			List<Integer> userVersionParts = Arrays.stream(userVersion.split("\\.")).map(Integer::parseInt).toList();
			List<Integer> updatedVersionParts = Arrays.stream(storeVersion.getVersion().split("\\.")).map(Integer::parseInt).toList();
			boolean isUpdated = compareVersions(userVersionParts, updatedVersionParts);
			storeVersion.setIsUpdated(isUpdated);
		}
		return storeVersion;
	}

	private boolean compareVersions(List<Integer> userVersion, List<Integer> updatedVersion) {
		Integer updatedMajorVersion = updatedVersion.get(0);
		Integer updatedMinorVersion = updatedVersion.get(1);
		Integer updatedPatchVersion = updatedVersion.get(2);

		Integer userMajorVersion = userVersion.get(0);
		Integer userMinorVersion = userVersion.get(1);
		Integer userPatchVersion = userVersion.get(2);

		if (Objects.equals(updatedMajorVersion, userMajorVersion)) {
			if (Objects.equals(updatedMinorVersion, userMinorVersion)) {
				return userPatchVersion >= updatedPatchVersion;
			} else {
				return userMinorVersion >= updatedMinorVersion;
			}

		} else {
			return userMajorVersion >= updatedMajorVersion;
		}

	}
}
