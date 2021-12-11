package airqo.repository;

import airqo.models.Insight;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface InsightRepository extends MongoRepository<Insight, String> {
	void deleteAllByTimeBefore(Date startTime);

	List<Insight> getAllByFrequencyAndSiteIdAndTimeBetween(String frequency, String siteId, Date startTime, Date endTime);
}
