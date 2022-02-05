package airqo.services;

import airqo.models.Site;
import airqo.models.Tenant;
import com.querydsl.core.types.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface SiteService {
	Page<Site> getSites(Predicate predicate, Pageable pageable);

	Site getSiteById(String id);

	List<Site> getSitesList(Predicate predicate);

	void insertSites(List<Site> sites, Tenant tenant);

	List<Site> getSites(Tenant tenant);

	void insertSite(Site sites);
}
