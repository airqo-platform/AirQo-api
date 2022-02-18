package airqo.services;

import airqo.models.Site;
import airqo.models.Tenant;
import airqo.repository.SiteRepository;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SiteServiceImpl implements SiteService {

	private final SiteRepository siteRepository;

	@Autowired
	public SiteServiceImpl(SiteRepository siteRepository) {
		this.siteRepository = siteRepository;
	}

	@Override
	@Cacheable(value = "viewSitesCache")
	public List<Site> getSites(Predicate predicate) {
		return (List<Site>) siteRepository.findAll(predicate);
	}

	@Override
	public void insertSites(List<Site> sites, Tenant tenant) {
		for (Site site : sites) {
			try {
				if (tenant != null) {
					site.setTenant(tenant.toString());
				}
				insertSite(site);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public void insertSite(Site site) {
		siteRepository.save(site);
	}
}
