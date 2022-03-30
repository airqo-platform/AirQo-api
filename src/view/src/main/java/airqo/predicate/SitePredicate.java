package airqo.predicate;

import airqo.models.QSite;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;

public class SitePredicate implements QuerydslBinderCustomizer<QSite> {

	@Override
	public void customize(QuerydslBindings bindings, QSite root) {
		bindings.excluding(root.devices);
	}
}
