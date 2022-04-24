package airqo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.annotation.PostConstruct;
import java.util.Date;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
@EnableCaching
public class ViewApplication {

	@PostConstruct
	public void init(){
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		System.out.println("Timezone set to UTC : " + new Date());
	}

    public static void main(String[] args) {
        SpringApplication.run(ViewApplication.class, args);
    }

}
