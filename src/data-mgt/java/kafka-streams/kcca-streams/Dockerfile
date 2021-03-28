# If you have maven installed on your machine,
# 1. copy the app.properties file to src/main/resources/
# 2. run mvn assembly:assembly
# 3. Comment out the second docker commands and build the image using the first docker commands.

# FROM openjdk:8-jre-alpine3.9
# WORKDIR /app/
# COPY target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /kcca.jar
# CMD ["java", "-jar", "/kcca.jar"]


FROM maven:3.6.1-jdk-8-alpine as build
COPY src /home/app/src
COPY pom.xml /home/app
COPY app.properties /home/app/src/main/resources/
RUN mvn -f /home/app/pom.xml assembly:assembly
FROM openjdk:8-jre-alpine3.9
COPY --from=build /home/app/target/kcca-device-measurements-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/lib/kcca.jar
ENTRYPOINT ["java","-jar","/usr/local/lib/kcca.jar"]