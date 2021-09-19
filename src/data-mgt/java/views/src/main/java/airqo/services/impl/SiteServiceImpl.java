package airqo.services.impl;

import airqo.models.Site;
import airqo.repository.SiteRepository;
import airqo.services.SiteService;
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
	public void insertSites(List<Site> sites) {
		siteRepository.saveAll(sites);
	}
}
