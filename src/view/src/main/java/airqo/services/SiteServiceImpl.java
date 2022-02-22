package airqo.services;

import airqo.models.Site;
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
	public void saveSites(List<Site> sites) {
		for (Site site : sites) {
			try {
				saveSite(site);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public void saveSite(Site site) {
		siteRepository.save(site);
	}
}
