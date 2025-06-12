// config/check-kafka-status.js
// Enhanced Kafka status and health check utility

const { Kafka } = require("kafkajs");

// Enhanced import fallback system
let constants, logObject, logText;

const importPaths = [
  { constants: "@config/constants", utils: "@utils/shared" },
  { constants: "../config/constants", utils: "../utils/shared" },
  { constants: "./constants", utils: null },
];

let imported = false;
for (const paths of importPaths) {
  try {
    constants = require(paths.constants);
    if (paths.utils) {
      const sharedUtils = require(paths.utils);
      logObject = sharedUtils.logObject || console.log;
      logText = sharedUtils.logText || console.log;
    } else {
      logObject = console.log;
      logText = console.log;
    }
    imported = true;
    break;
  } catch (error) {
    // Continue to next import path
  }
}

if (!imported) {
  console.warn(
    "⚠️  Could not import constants or shared utils, using fallbacks"
  );
  constants = {
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
    KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS
      ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(",")
      : ["localhost:9092"],
    UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
    SERVICE_NAME: process.env.SERVICE_NAME,
  };
  logObject = console.log;
  logText = console.log;
}

class KafkaStatusChecker {
  constructor() {
    this.kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID || "kafka-status-checker",
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS || ["localhost:9092"],
      requestTimeout: 10000,
      connectionTimeout: 5000,
    });

    this.admin = this.kafka.admin();
    this.isConnected = false;

    // Service-specific topic configurations
    this.serviceTopics = this.getServiceTopics();
  }

  getServiceTopics() {
    // Use service detector for automatic service detection
    try {
      const { getServiceConfig } = require("./service-detector");
      const config = getServiceConfig();

      return {
        serviceName: config.serviceName,
        topics: config.kafkaTopics || [],
        consumerGroup:
          constants.UNIQUE_CONSUMER_GROUP || config.defaultConsumerGroup,
      };
    } catch (error) {
      // Fallback to manual detection if service-detector is not available
      const serviceName =
        constants.SERVICE_NAME || process.env.SERVICE_NAME || "unknown";

      if (serviceName.includes("device") || serviceName.includes("registry")) {
        return {
          serviceName: "Device Registry",
          topics: ["hourly-measurements-topic", "airqo.forecasts"],
          consumerGroup:
            constants.UNIQUE_CONSUMER_GROUP || "device-registry-consumer-group",
        };
      } else if (serviceName.includes("auth")) {
        return {
          serviceName: "Auth Service",
          topics: ["ip-address", "deploy-topic", "recall-topic", "sites-topic"],
          consumerGroup:
            constants.UNIQUE_CONSUMER_GROUP || "auth-service-consumer-group",
        };
      } else {
        return {
          serviceName: "Unknown Service",
          topics: [],
          consumerGroup:
            constants.UNIQUE_CONSUMER_GROUP || "default-consumer-group",
        };
      }
    }
  }

  async connect() {
    try {
      console.log("🔌 Connecting to Kafka cluster...");
      await this.admin.connect();
      this.isConnected = true;
      console.log("✅ Successfully connected to Kafka cluster");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to Kafka cluster:", error.message);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await this.admin.disconnect();
        this.isConnected = false;
        console.log("👋 Disconnected from Kafka cluster");
      }
    } catch (error) {
      console.error("⚠️  Error disconnecting from Kafka:", error.message);
    }
  }

  async checkBrokerStatus() {
    try {
      console.log("\n📡 Checking Kafka Broker Status...");

      const metadata = await this.admin.fetchTopicMetadata();

      if (metadata.brokers?.length > 0) {
        console.log(`✅ Found ${metadata.brokers.length} broker(s):`);
        metadata.brokers.forEach((broker, index) => {
          console.log(
            `   ${index + 1}. Broker ${broker.nodeId}: ${broker.host}:${
              broker.port
            }`
          );
        });
        return true;
      } else {
        console.log("❌ No brokers found");
        return false;
      }
    } catch (error) {
      console.error("❌ Error checking broker status:", error.message);
      return false;
    }
  }

  async checkTopicStatus() {
    try {
      console.log(
        `\n📋 Checking Topic Status for ${this.serviceTopics.serviceName}...`
      );

      const existingTopics = await this.admin.listTopics();

      if (!this.serviceTopics.topics?.length) {
        console.log("⚠️  No service-specific topics configured");
        console.log("📊 All available topics:");
        existingTopics.forEach((topic, index) => {
          console.log(`   ${index + 1}. ${topic}`);
        });
        return true;
      }

      let allTopicsExist = true;

      for (const topic of this.serviceTopics.topics) {
        if (existingTopics.includes(topic)) {
          console.log(`✅ Topic '${topic}' exists`);
        } else {
          console.log(`❌ Topic '${topic}' does not exist`);
          allTopicsExist = false;
        }
      }

      // Get detailed topic metadata
      if (allTopicsExist) {
        const topicMetadata = await this.admin.fetchTopicMetadata({
          topics: this.serviceTopics.topics,
        });

        console.log("\n📊 Topic Details:");
        topicMetadata.topics.forEach((topic) => {
          console.log(`   📁 ${topic.name}:`);
          console.log(`      Partitions: ${topic.partitions.length}`);
          topic.partitions.forEach((partition) => {
            console.log(
              `         Partition ${partition.partitionId}: Leader ${partition.leader}`
            );
          });
        });
      }

      return allTopicsExist;
    } catch (error) {
      console.error("❌ Error checking topic status:", error.message);
      return false;
    }
  }

  async checkConsumerGroupStatus() {
    try {
      console.log(`\n👥 Checking Consumer Group Status...`);

      const groups = await this.admin.listGroups();
      const targetGroup = this.serviceTopics.consumerGroup;

      const groupExists = groups.groups.some(
        (group) => group.groupId === targetGroup
      );

      if (!groupExists) {
        console.log(`❌ Consumer group '${targetGroup}' not found`);
        console.log("📊 Available consumer groups:");
        groups.groups.forEach((group, index) => {
          console.log(
            `   ${index + 1}. ${group.groupId} (${group.protocolType})`
          );
        });
        return false;
      }

      console.log(`✅ Consumer group '${targetGroup}' exists`);

      // Get detailed consumer group info
      try {
        const groupDescription = await this.admin.describeGroups([targetGroup]);
        const group = groupDescription.groups[0];

        console.log(`   State: ${group.state}`);
        console.log(`   Protocol: ${group.protocolType}`);
        console.log(`   Members: ${group.members.length}`);

        if (group.members.length > 0) {
          group.members.forEach((member, index) => {
            console.log(
              `      ${index + 1}. Member ${member.memberId.substring(0, 8)}...`
            );
          });
        }

        // Check consumer group offsets if topics exist
        if (this.serviceTopics.topics?.length) {
          const offsets = await this.admin.fetchOffsets({
            groupId: targetGroup,
            topics: this.serviceTopics.topics.map((topic) => ({ topic })),
          });

          console.log("   📊 Consumer Offsets:");
          offsets.forEach((topicOffset) => {
            console.log(`      ${topicOffset.topic}:`);
            topicOffset.partitions.forEach((partition) => {
              console.log(
                `         Partition ${partition.partition}: ${partition.offset}`
              );
            });
          });
        }
      } catch (detailError) {
        console.log(
          `⚠️  Could not get detailed group info: ${detailError.message}`
        );
      }

      return true;
    } catch (error) {
      console.error("❌ Error checking consumer group status:", error.message);
      return false;
    }
  }

  async checkConfiguration() {
    console.log("\n⚙️  Kafka Configuration:");
    console.log(`   Service: ${this.serviceTopics.serviceName}`);
    console.log(
      `   Client ID: ${constants.KAFKA_CLIENT_ID || "Not configured"}`
    );
    console.log(
      `   Brokers: ${JSON.stringify(
        constants.KAFKA_BOOTSTRAP_SERVERS || "Not configured"
      )}`
    );
    console.log(`   Consumer Group: ${this.serviceTopics.consumerGroup}`);

    // FIXED: Safe handling of topics array
    console.log(
      `   Expected Topics: ${
        this.serviceTopics.topics?.length
          ? this.serviceTopics.topics.join(", ")
          : "None configured"
      }`
    );
  }

  async runFullCheck() {
    console.log("🚀 Starting Kafka Health Check...");
    console.log("=".repeat(50));

    this.checkConfiguration();

    const connected = await this.connect();
    if (!connected) {
      console.log("\n❌ Cannot proceed with health check - connection failed");
      return false;
    }

    try {
      const brokerStatus = await this.checkBrokerStatus();
      const topicStatus = await this.checkTopicStatus();
      const consumerStatus = await this.checkConsumerGroupStatus();

      console.log("\n" + "=".repeat(50));
      console.log("📊 HEALTH CHECK SUMMARY:");
      console.log(
        `   Kafka Connection: ${connected ? "✅ HEALTHY" : "❌ FAILED"}`
      );
      console.log(
        `   Broker Status: ${brokerStatus ? "✅ HEALTHY" : "❌ FAILED"}`
      );
      console.log(
        `   Topic Status: ${topicStatus ? "✅ HEALTHY" : "❌ FAILED"}`
      );
      console.log(
        `   Consumer Group: ${consumerStatus ? "✅ HEALTHY" : "❌ FAILED"}`
      );

      const overallHealth =
        connected && brokerStatus && topicStatus && consumerStatus;
      console.log(
        `   Overall Health: ${overallHealth ? "✅ HEALTHY" : "❌ UNHEALTHY"}`
      );

      if (!overallHealth) {
        console.log("\n🛠️  TROUBLESHOOTING TIPS:");
        if (!connected) {
          console.log("   • Check if Kafka brokers are running");
          console.log("   • Verify KAFKA_BOOTSTRAP_SERVERS configuration");
          console.log("   • Check network connectivity to Kafka cluster");
        }
        if (!topicStatus) {
          console.log("   • Create missing topics or check topic permissions");
          console.log("   • Verify topic naming conventions");
        }
        if (!consumerStatus) {
          console.log(
            "   • Start the Kafka consumer to create the consumer group"
          );
          console.log("   • Check consumer group permissions");
        }
      }

      return overallHealth;
    } finally {
      await this.disconnect();
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🔍 Kafka Status Checker

Check the health and status of Kafka infrastructure for your service.

USAGE:
  node config/check-kafka-status.js [options]

OPTIONS:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output
  --quick, -q    Run quick check (brokers only)

EXAMPLES:
  node config/check-kafka-status.js                # Full health check
  node config/check-kafka-status.js --quick        # Quick broker check
  node config/check-kafka-status.js --verbose      # Detailed output

INTEGRATION:
  npm run kafka:check                               # Via package.json script
`);
    process.exit(0);
  }

  const checker = new KafkaStatusChecker();

  try {
    if (args.includes("--quick") || args.includes("-q")) {
      const connected = await checker.connect();
      if (connected) {
        await checker.checkBrokerStatus();
        await checker.disconnect();
      }
    } else {
      await checker.runFullCheck();
    }
  } catch (error) {
    console.error("💥 Unexpected error during Kafka check:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  });
}

module.exports = KafkaStatusChecker;
