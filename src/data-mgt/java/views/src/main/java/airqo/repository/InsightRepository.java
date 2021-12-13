package airqo.repository;

import airqo.models.Insight;
import airqo.models.QInsight;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;

import java.util.Date;

@Repository
public interface InsightRepository extends MongoRepository<Insight, String>, QuerydslPredicateExecutor<Insight>, QuerydslBinderCustomizer<QInsight> {

	@Override
	default void customize(QuerydslBindings querydslBindings, QInsight qInsight) {
	}

	void deleteAllByTimeBefore(Date startTime);
}
