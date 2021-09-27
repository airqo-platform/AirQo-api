package airqo.services;

import airqo.models.Site;
import airqo.models.Tenant;
import airqo.repository.SiteRepository;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SiteServiceImpl implements SiteService {

	@Autowired
	SiteRepository siteRepository;

	@Override
	public Page<Site> getSites(Predicate predicate, Pageable pageable) {
		return siteRepository.findAll(predicate, pageable);
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
