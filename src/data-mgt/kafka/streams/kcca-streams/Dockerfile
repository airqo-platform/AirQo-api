# If you have maven installed on your machine,
# 2. run mvn assembly:assembly
# 3. Comment out the second docker commands and build the image using the first docker commands.

# FROM openjdk:8-jre-alpine3.9
# WORKDIR /app/
# COPY target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /kcca.jar
# CMD ["java", "-jar", "/kcca.jar"]


FROM maven:3.6.1-jdk-8-alpine as build
COPY src /home/app/src
COPY pom.xml /home/app
# RUN mvn -f /home/app/pom.xml '-Dtest=net.airqo.*Test' test
RUN mvn -f /home/app/pom.xml assembly:assembly -DskipTest
FROM openjdk:8-jre-alpine3.9
COPY --from=build /home/app/target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/lib/kcca.jar
ENTRYPOINT ["java","-jar","/usr/local/lib/kcca.jar"]