package airqo.repository;


import airqo.models.QWeather;
import airqo.models.Weather;
import com.mongodb.lang.NonNull;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;


@Repository
public interface WeatherRepository extends MongoRepository<Weather, String>, QuerydslPredicateExecutor<Weather>, QuerydslBinderCustomizer<QWeather> {

	@Override
	default void customize(@NonNull QuerydslBindings querydslBindings, @NonNull QWeather qWeather) {
		querydslBindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		querydslBindings.excluding(qWeather.id);
	}

}
