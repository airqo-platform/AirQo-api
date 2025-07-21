package airqo.services;

import airqo.models.Insight;
import airqo.models.InsightData;

import java.util.Date;
import java.util.List;

public interface InsightsService {

	void updateInsightsCache(List<String> siteIds);

	List<Insight> getInsights(Date startDateTime, Date endDateTime, List<String> siteIds);

	InsightData getInsights(Date startDateTime, Date endDateTime, String siteId, int utcOffSet);
}
