package airqo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableMongoRepositories
@EnableSpringDataWebSupport
@EnableScheduling
public class ViewsApplication {

	public static void main(String[] args) {
		SpringApplication.run(ViewsApplication.class, args);
	}

}
