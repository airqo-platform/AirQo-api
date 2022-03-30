package airqo.predicate;

import airqo.models.QInsight;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;

public class InsightPredicate implements QuerydslBinderCustomizer<QInsight> {

	@Override
	public void customize(QuerydslBindings bindings, QInsight root) {

		bindings.bind(root.frequency).first((path, value) -> root.frequency.eq(value));

		bindings.bind(root.siteId).first((path, value) -> root.siteId.in(value.split(",")));

		bindings.bind(root.startDateTime).first((path, value) ->
			root.time.goe(value));

		bindings.bind(root.endDateTime).first((path, value) ->
			root.time.loe(value));

		bindings.excluding(root.id, root.pm2_5, root.pm10, root.time);
	}
}
