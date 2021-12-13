package airqo.controllers;

import airqo.models.Site;
import airqo.services.SiteService;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Profile({"api"})
@RestController
@RequestMapping("sites")
public class SiteController {

	@Autowired
	SiteService siteService;

	@Autowired
	Environment env;

	@GetMapping("")
	public ResponseEntity<?> getSitesList(
		@QuerydslPredicate(root = Site.class) Predicate predicate) {

		List<Site> sites = siteService.getSitesList(predicate);
		return new ResponseEntity<>(sites, new HttpHeaders(), HttpStatus.OK);
	}

	@GetMapping("/paged")
	public ResponseEntity<?> getSites(
		@QuerydslPredicate(root = Site.class) Predicate predicate,
		Pageable pageable) {
		Page<Site> sites = siteService.getSites(predicate, pageable);
		return new ResponseEntity<>(sites, new HttpHeaders(), HttpStatus.OK);
	}
}
