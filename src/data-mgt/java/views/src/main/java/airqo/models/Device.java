package airqo.models;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.Date;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Document("devices")
public class Device {

    @Field("_id")
    @Id
    @JsonAlias("_id")
    private String id;

    @JsonAlias("long_name")
    private String longName = "";

    @JsonAlias("deployment_date")
    private Date deploymentDate = new Date();

    @JsonAlias("maintenance_date")
    private Date maintenanceDate = new Date();

    @JsonAlias("recall_date")
    private Date recallDate = new Date();

    @DBRef
    private Site site = new Site();

    private String name = "";
    private String tenant = "";
    private String mountType = "";
    private Double height;
    private boolean primaryInLocation = false;
    private Date nextMaintenance = new Date();
    private boolean isActive = false;
    private Integer deviceNumber = 0;
    private String description = "";
    private Date createdAt = new Date();
    private boolean visibility = false;
    private String writeKey = "";
    private String readKey = "";
    private Double latitude;
    private Double longitude;
}
