FROM maven:3.8.1-jdk-11-slim as build
WORKDIR /home/app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src/ /home/app/src
#RUN mvn compile assembly:single -DskipTest
RUN mvn package assembly:single -Dmaven.test.skip=true

FROM openjdk:11-jre-slim
COPY --from=build /home/app/target/streams-measurements-jar-with-dependencies.jar /usr/local/lib/streams-measurements.jar
ENTRYPOINT ["java","-jar","/usr/local/lib/streams-measurements.jar"]