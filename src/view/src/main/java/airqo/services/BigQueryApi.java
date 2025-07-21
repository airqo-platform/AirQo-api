package airqo.services;

import airqo.models.GraphInsight;
import airqo.models.Insight;

import java.util.Date;
import java.util.List;

public interface BigQueryApi {
	List<GraphInsight> getInsights(Date startDateTime, Date endDateTime, String siteId);

	List<GraphInsight> cacheInsights(Date startDateTime, Date endDateTime, String siteId);

	List<Insight> getInsights(Date startDateTime, Date endDateTime, List<String> siteIds);

}
