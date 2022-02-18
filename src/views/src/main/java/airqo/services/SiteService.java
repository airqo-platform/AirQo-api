package airqo.services;

import airqo.models.Site;
import airqo.models.Tenant;
import com.querydsl.core.types.Predicate;

import java.util.List;

public interface SiteService {

	List<Site> getSites(Predicate predicate);

	void insertSites(List<Site> sites, Tenant tenant);

	void insertSite(Site sites);
}
