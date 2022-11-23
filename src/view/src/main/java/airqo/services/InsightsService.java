package airqo.services;

import airqo.models.InsightData;

import java.util.Date;

public interface InsightsService {
	InsightData getInsights(Date startDateTime, Date endDateTime, String siteId, int utcOffSet);
}
