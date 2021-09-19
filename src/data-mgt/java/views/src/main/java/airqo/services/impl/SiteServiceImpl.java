package airqo.services.impl;

import airqo.models.Site;
import airqo.repository.SiteRepository;
import airqo.services.SiteService;
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
    public Page<Site> getSites(Pageable pageable) {
        return siteRepository.findAll(pageable);
    }

    @Override
    public void insertSites(List<Site> sites) {
        siteRepository.saveAll(sites);
    }
}
