package airqo.predicate;

import airqo.config.CustomException;
import airqo.models.QInsight;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

public class InsightPredicate implements QuerydslBinderCustomizer<QInsight> {

	@Override
	public void customize(QuerydslBindings bindings, QInsight root) {

		bindings.bind(root.frequency).first((path, value) -> root.frequency.eq(value));

		bindings.bind(root.siteId).first((path, value) -> root.siteId.in(value.split(",")));

		bindings.bind(root.time)
			.all((path, value) -> {
				List<? extends Date> dates = new ArrayList<>(value);
				if (dates.size() == 1 && dates.get(0) != null) {
					return Optional.of(path.goe(dates.get(0)));
				} else if (dates.size() >= 2) {
					if (dates.get(0) == null) {
						throw new CustomException("First time value cannot be null");
					}
					if (dates.get(1) == null) {
						throw new CustomException("Second time value cannot be null");
					}
					Date startTime = dates.get(0);
					Date endTime = dates.get(1);
					return startTime.before(endTime) ? Optional.of(path.goe(startTime).and(path.loe(endTime))) : Optional.of(path.goe(endTime).and(path.loe(startTime)));
				}
				return Optional.empty();
			});

		bindings.excluding(root.id, root.pm2_5, root.pm10);
	}
}
