package airqo.controllers;

import airqo.models.Site;
import airqo.services.SiteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("sites")
public class SiteController {

    @Autowired
    SiteService siteService;

    @GetMapping("")
    public ResponseEntity<?> getSites(
            @QuerydslPredicate(root = Site.class)
                    Pageable pageable) {
        Page<Site> sites = siteService.getSites(pageable);
        return new ResponseEntity<>(sites, new HttpHeaders(), HttpStatus.OK);
    }
}
