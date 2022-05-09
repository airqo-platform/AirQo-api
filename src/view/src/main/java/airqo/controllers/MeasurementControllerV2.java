package airqo.controllers;

import airqo.models.Insight;
import airqo.predicate.InsightPredicate;
import airqo.serializers.Views;
import airqo.services.MeasurementService;
import com.fasterxml.jackson.annotation.JsonView;
import com.querydsl.core.types.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.querydsl.binding.QuerydslPredicate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@Profile({"api"})
@RestController
@RequestMapping("v2/view/measurements")
public class MeasurementControllerV2 {

	private final MeasurementService measurementService;

	@Autowired
	public MeasurementControllerV2(MeasurementService measurementService) {
		this.measurementService = measurementService;
	}

	@JsonView(Views.LatestInsightView.class)
	@GetMapping("/app/insights/latest")
	public List<Insight> getLatestInsights() {
		return measurementService.apiGetLatestInsights();
	}

	@JsonView(Views.GraphInsightView.class)
	@GetMapping("/app/insights")
	public List<Insight> getInsights(
		@QuerydslPredicate(root = Insight.class, bindings = InsightPredicate.class) Predicate predicate) {
		log.debug("{}", predicate);
		return measurementService.apiGetInsights(predicate);
	}

}
