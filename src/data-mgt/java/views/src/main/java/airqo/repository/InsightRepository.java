package airqo.repository;

import airqo.models.Insight;
import airqo.models.QInsight;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface InsightRepository extends MongoRepository<Insight, String>, QuerydslPredicateExecutor<Insight>, QuerydslBinderCustomizer<QInsight> {

	@Override
	default void customize(@NonNull QuerydslBindings querydslBindings, @NonNull QInsight qInsight) {
		querydslBindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		querydslBindings.excluding(qInsight.id);
	}

	void deleteAllByTimeBefore(Date time);

	List<Insight> findAllByTimeBeforeAndForecast(Date time, boolean forecast);
}
