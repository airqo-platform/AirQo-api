package airqo.predicate;

import airqo.models.QDevice;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;

public class DevicePredicate implements QuerydslBinderCustomizer<QDevice> {

	@Override
	public void customize(QuerydslBindings bindings, QDevice root) {
		bindings.excluding(root.site);
	}
}
