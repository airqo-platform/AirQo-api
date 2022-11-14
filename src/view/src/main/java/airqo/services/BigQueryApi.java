package airqo.services;

import airqo.models.GraphInsight;

import java.util.Date;
import java.util.List;

public interface BigQueryApi {
	List<GraphInsight> getInsights(Date startDateTime, Date endDateTime, String siteId);

}
