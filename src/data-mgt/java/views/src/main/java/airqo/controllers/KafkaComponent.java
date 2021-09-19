package airqo.controllers;

import airqo.models.Device;
import airqo.models.Event;
import airqo.models.Site;
import airqo.services.DeviceService;
import airqo.services.EventService;
import airqo.services.SiteService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class KafkaComponent {

    Logger logger = LoggerFactory.getLogger(getClass());

    @Autowired
    EventService eventService;

    @Autowired
    SiteService siteService;

    @Autowired
    DeviceService deviceService;

    @KafkaListener(topics = "#{'${spring.kafka.consumer.topics.sites}'.split(',')}")
    public void receiveSites(String content) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Site site = objectMapper.readValue(content, Site.class);
            List<Site> sites = new ArrayList<>();
            sites.add(site);
            siteService.insertSites(sites);
            logger.info("{}", sites);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    @KafkaListener(topics = "#{'${spring.kafka.consumer.topics.devices}'.split(',')}")
    public void receiveDevices(String content) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Device device = objectMapper.readValue(content, Device.class);
            List<Device> devices = new ArrayList<>();
            devices.add(device);
            deviceService.insertDevices(devices);
            logger.info("{}", devices);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    @KafkaListener(topics = "#{'${spring.kafka.consumer.topics.events}'.split(',')}")
    public void receiveEvents(String content) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Event event = objectMapper.readValue(content, Event.class);
            List<Event> events = new ArrayList<>();
            events.add(event);
            eventService.insertEvents(events);
            logger.info("{}", event);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }
}
