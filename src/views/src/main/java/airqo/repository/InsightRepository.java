package airqo.repository;

import airqo.models.Insight;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface InsightRepository extends BaseRepository<Insight> {

	void deleteAllByTimeBefore(Date time);

	List<Insight> findAllByTimeBefore(Date time);

}
