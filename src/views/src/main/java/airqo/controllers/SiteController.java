package airqo.controllers;

import airqo.models.Site;
import airqo.predicate.SitePredicate;
import airqo.services.SiteService;
import com.querydsl.core.types.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
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

	private final SiteService siteService;

	@Autowired
	public SiteController(SiteService siteService) {
		this.siteService = siteService;
	}

	@GetMapping("")
	public ResponseEntity<?> getSites(
		@QuerydslPredicate(root = Site.class, bindings = SitePredicate.class) Predicate predicate) {

		List<Site> sites = siteService.getSites(predicate);
		return new ResponseEntity<>(sites, new HttpHeaders(), HttpStatus.OK);
	}

}
