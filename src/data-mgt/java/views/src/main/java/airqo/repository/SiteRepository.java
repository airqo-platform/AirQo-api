package airqo.repository;

import airqo.models.Site;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteRepository extends MongoRepository<Site, String>, QuerydslPredicateExecutor<Site> {
}
