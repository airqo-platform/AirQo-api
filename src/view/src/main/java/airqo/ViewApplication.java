package airqo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import javax.annotation.PostConstruct;
import java.util.Date;
import java.util.TimeZone;

@SpringBootApplication
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
