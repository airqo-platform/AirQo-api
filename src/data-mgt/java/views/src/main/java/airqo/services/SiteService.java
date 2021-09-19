package airqo.services;

import airqo.models.Site;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface SiteService {
    Page<Site> getSites(Pageable pageable);

    void insertSites(List<Site> sites);
}
