package airqo.services;

import airqo.models.Site;
import com.querydsl.core.types.Predicate;

import java.util.List;

public interface SiteService {

	List<Site> getSites(Predicate predicate);

	void saveSites(List<Site> sites);

	void saveSite(Site site);
}
