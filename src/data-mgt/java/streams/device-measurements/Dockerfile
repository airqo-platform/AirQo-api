#FROM maven:3.6.1-jdk-8-alpine as build
#COPY src /home/app/src
#COPY pom.xml /home/app
## RUN mvn -f /home/app/pom.xml '-Dtest=net.airqo.*Test' test
#RUN mvn -f /home/app/pom.xml assembly:assembly -DskipTest
#FROM openjdk:8-jre-alpine3.9
#COPY --from=build /home/app/target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/lib/measurements.jar
#ENTRYPOINT ["java","-jar","/usr/local/lib/measurements.jar"]

FROM maven:3.8.1-jdk-11-slim as build
COPY src /home/app/src
COPY pom.xml /home/app
WORKDIR /home/app
RUN mvn dependency:resolve
#RUN mvn clean compile assembly:single -DskipTest
RUN mvn assembly:single -DskipTest
FROM openjdk:11-jre-slim
COPY --from=build /home/app/target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/lib/measurements.jar
ENTRYPOINT ["java","-jar","/usr/local/lib/measurements.jar"]