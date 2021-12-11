package airqo.repository;

import airqo.models.QSite;
import airqo.models.Site;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteRepository extends MongoRepository<Site, String>, QuerydslPredicateExecutor<Site>, QuerydslBinderCustomizer<QSite> {

	@Override
	default void customize(QuerydslBindings bindings, QSite root) {
		bindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		bindings.excluding(root.recallDate);
	}

	List<Site> findAllByTenant(String tenant);
}
