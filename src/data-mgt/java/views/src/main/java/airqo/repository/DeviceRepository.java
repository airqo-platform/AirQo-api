package airqo.repository;

import airqo.models.Device;
import airqo.models.QDevice;
import com.querydsl.core.types.dsl.StringPath;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.querydsl.binding.QuerydslBinderCustomizer;
import org.springframework.data.querydsl.binding.QuerydslBindings;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeviceRepository extends MongoRepository<Device, String>, QuerydslPredicateExecutor<Device>, QuerydslBinderCustomizer<QDevice> {

	@Override
	default void customize(QuerydslBindings bindings, QDevice root) {
		bindings.bind(String.class).first(
			(StringPath path, String value) -> path.containsIgnoreCase(value));
		bindings.excluding(root.deploymentDate, root.site, root.createdAt, root.maintenanceDate);
	}

	List<Device> getAllByTenant(String tenant);

	Device getByIdOrName(String id, String name);

}
