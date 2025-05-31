// config/cleanup-kafka.js
// Kafka consumer cleanup and reset utility

const { Kafka } = require("kafkajs");

// Handle different import paths for different services
let constants, logObject, logText;

try {
  // Try auth service style imports first
  constants = require("@config/constants");
  const sharedUtils = require("@utils/shared");
  logObject = sharedUtils.logObject;
  logText = sharedUtils.logText;
} catch (error) {
  try {
    // Try relative path imports
    constants = require("../config/constants");
    const sharedUtils = require("../utils/shared");
    logObject = sharedUtils.logObject;
    logText = sharedUtils.logText;
  } catch (error2) {
    try {
      // Try direct path imports
      constants = require("./constants");
      logObject = console.log;
      logText = console.log;
    } catch (error3) {
      // Fallback to environment variables and basic logging
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
  }
}

class KafkaCleanup {
  constructor() {
    this.kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID || "kafka-cleanup-tool",
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS || ["localhost:9092"],
      requestTimeout: 15000,
      connectionTimeout: 10000,
    });

    this.admin = this.kafka.admin();
    this.isConnected = false;

    // Service-specific configurations
    this.serviceConfig = this.getServiceConfig();
  }

  getServiceConfig() {
    // Use service detector for automatic service detection
    try {
      const { getServiceConfig } = require("./service-detector");
      const config = getServiceConfig();

      return {
        serviceName: config.serviceName,
        topics: config.kafkaTopics,
        consumerGroup:
          constants.UNIQUE_CONSUMER_GROUP || config.defaultConsumerGroup,
        defaultClientId: `${config.serviceType}-cleanup`,
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
          defaultClientId: "device-registry-cleanup",
        };
      } else if (serviceName.includes("auth")) {
        return {
          serviceName: "Auth Service",
          topics: ["ip-address", "deploy-topic", "recall-topic", "sites-topic"],
          consumerGroup:
            constants.UNIQUE_CONSUMER_GROUP || "auth-service-consumer-group",
          defaultClientId: "auth-service-cleanup",
        };
      } else {
        return {
          serviceName: "Unknown Service",
          topics: [],
          consumerGroup:
            constants.UNIQUE_CONSUMER_GROUP || "default-consumer-group",
          defaultClientId: "generic-cleanup",
        };
      }
    }
  }

  async connect() {
    try {
      console.log("🔌 Connecting to Kafka cluster for cleanup...");
      await this.admin.connect();
      this.isConnected = true;
      console.log("✅ Connected to Kafka cluster");
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

  async deleteConsumerGroup(groupId = null) {
    try {
      const targetGroup = groupId || this.serviceConfig.consumerGroup;
      console.log(`🗑️  Deleting consumer group: ${targetGroup}`);

      // Check if group exists first
      const groups = await this.admin.listGroups();
      const groupExists = groups.groups.some(
        (group) => group.groupId === targetGroup
      );

      if (!groupExists) {
        console.log(`⚠️  Consumer group '${targetGroup}' does not exist`);
        return true;
      }

      await this.admin.deleteGroups([targetGroup]);
      console.log(`✅ Successfully deleted consumer group: ${targetGroup}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting consumer group: ${error.message}`);
      return false;
    }
  }

  async resetConsumerOffsets(groupId = null, resetType = "earliest") {
    try {
      const targetGroup = groupId || this.serviceConfig.consumerGroup;
      console.log(`🔄 Resetting consumer offsets for group: ${targetGroup}`);

      // Check if topics exist
      const existingTopics = await this.admin.listTopics();
      const topicsToReset = this.serviceConfig.topics.filter((topic) =>
        existingTopics.includes(topic)
      );

      if (topicsToReset.length === 0) {
        console.log("⚠️  No valid topics found to reset offsets");
        return false;
      }

      // Create a temporary consumer for resetting offsets
      const consumer = this.kafka.consumer({
        groupId: targetGroup,
        enableAutoCommit: false,
      });

      try {
        await consumer.connect();

        for (const topic of topicsToReset) {
          console.log(`   📋 Resetting offsets for topic: ${topic}`);

          await consumer.subscribe({
            topic,
            fromBeginning: resetType === "earliest",
          });

          // Get topic metadata to know partitions
          const metadata = await this.admin.fetchTopicMetadata({
            topics: [topic],
          });
          const topicInfo = metadata.topics[0];

          if (!topicInfo) {
            console.log(`   ⚠️  Could not get metadata for topic: ${topic}`);
            continue;
          }

          // Reset offsets for each partition
          const partitions = topicInfo.partitions.map((p) => ({
            partition: p.partitionId,
            offset: resetType === "earliest" ? "0" : "-1", // -1 means latest
          }));

          await consumer.seek({
            topic,
            partition: 0,
            offset: resetType === "earliest" ? "0" : "-1",
          });
          console.log(
            `   ✅ Reset ${partitions.length} partition(s) to ${resetType}`
          );
        }

        await consumer.disconnect();
        console.log(`✅ Successfully reset offsets for group: ${targetGroup}`);
        return true;
      } catch (consumerError) {
        console.error(
          `❌ Error with consumer operations: ${consumerError.message}`
        );
        await consumer.disconnect();
        return false;
      }
    } catch (error) {
      console.error(`❌ Error resetting consumer offsets: ${error.message}`);
      return false;
    }
  }

  async clearConsumerGroupOffsets(groupId = null) {
    try {
      const targetGroup = groupId || this.serviceConfig.consumerGroup;
      console.log(`🧹 Clearing all offsets for consumer group: ${targetGroup}`);

      // First try to delete the entire consumer group (this clears all offsets)
      const deleteSuccess = await this.deleteConsumerGroup(targetGroup);

      if (deleteSuccess) {
        console.log(`✅ Consumer group deleted - all offsets cleared`);
        return true;
      } else {
        console.log(
          `⚠️  Could not delete consumer group, trying manual offset reset`
        );
        return await this.resetConsumerOffsets(targetGroup, "earliest");
      }
    } catch (error) {
      console.error(
        `❌ Error clearing consumer group offsets: ${error.message}`
      );
      return false;
    }
  }

  async cleanupStaleConsumers() {
    try {
      console.log("🧹 Cleaning up stale consumers...");

      const groups = await this.admin.listGroups();
      let staleGroups = [];

      // Look for groups that match our service pattern but might be stale
      const servicePattern = this.serviceConfig.serviceName
        .toLowerCase()
        .replace(/\s+/g, "-");

      for (const group of groups.groups) {
        if (
          group.groupId.includes(servicePattern) ||
          group.groupId === this.serviceConfig.consumerGroup
        ) {
          try {
            const description = await this.admin.describeGroups([
              group.groupId,
            ]);
            const groupInfo = description.groups[0];

            // Check if group is empty or dead
            if (groupInfo.state === "Dead" || groupInfo.state === "Empty") {
              staleGroups.push(group.groupId);
            }
          } catch (describeError) {
            console.log(
              `   ⚠️  Could not describe group ${group.groupId}: ${describeError.message}`
            );
          }
        }
      }

      if (staleGroups.length === 0) {
        console.log("✅ No stale consumer groups found");
        return true;
      }

      console.log(`📋 Found ${staleGroups.length} stale consumer group(s):`);
      staleGroups.forEach((group) => console.log(`   • ${group}`));

      // Delete stale groups
      for (const groupId of staleGroups) {
        await this.deleteConsumerGroup(groupId);
      }

      console.log(
        `✅ Cleaned up ${staleGroups.length} stale consumer group(s)`
      );
      return true;
    } catch (error) {
      console.error(`❌ Error cleaning up stale consumers: ${error.message}`);
      return false;
    }
  }

  async validateTopicsAfterCleanup() {
    try {
      console.log("🔍 Validating topics after cleanup...");

      const existingTopics = await this.admin.listTopics();
      const missingTopics = this.serviceConfig.topics.filter(
        (topic) => !existingTopics.includes(topic)
      );

      if (missingTopics.length > 0) {
        console.log("⚠️  Some expected topics are missing:");
        missingTopics.forEach((topic) => console.log(`   • ${topic}`));
        console.log("   These will be auto-created when the consumer starts");
      } else {
        console.log("✅ All expected topics are present");
      }

      return true;
    } catch (error) {
      console.error(`❌ Error validating topics: ${error.message}`);
      return false;
    }
  }

  async fullCleanup(options = {}) {
    console.log("🚀 Starting Kafka Cleanup...");
    console.log("=".repeat(50));

    console.log(`🏷️  Service: ${this.serviceConfig.serviceName}`);
    console.log(`👥 Consumer Group: ${this.serviceConfig.consumerGroup}`);
    console.log(`📋 Topics: ${this.serviceConfig.topics.join(", ")}`);
    console.log("");

    const connected = await this.connect();
    if (!connected) {
      console.log("❌ Cannot proceed with cleanup - connection failed");
      return false;
    }

    try {
      let success = true;

      // Step 1: Clean up stale consumers
      if (options.cleanStale !== false) {
        console.log("🧹 Step 1: Cleaning up stale consumers...");
        success = (await this.cleanupStaleConsumers()) && success;
      }

      // Step 2: Clear consumer group offsets
      if (options.clearOffsets !== false) {
        console.log("\n🔄 Step 2: Clearing consumer group offsets...");
        success = (await this.clearConsumerGroupOffsets()) && success;
      }

      // Step 3: Validate topics
      if (options.validateTopics !== false) {
        console.log("\n🔍 Step 3: Validating topics...");
        success = (await this.validateTopicsAfterCleanup()) && success;
      }

      console.log("\n" + "=".repeat(50));
      console.log("📊 CLEANUP SUMMARY:");
      console.log(
        `   Overall Status: ${success ? "✅ SUCCESS" : "❌ PARTIAL FAILURE"}`
      );

      if (success) {
        console.log("\n🎉 Kafka cleanup completed successfully!");
        console.log("💡 You can now restart your Kafka consumer safely");
      } else {
        console.log("\n⚠️  Cleanup completed with some issues");
        console.log("💡 Check the logs above for specific errors");
      }

      return success;
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
🧹 Kafka Cleanup Utility

Clean up Kafka consumer groups, reset offsets, and remove stale consumers.

USAGE:
  node config/cleanup-kafka.js [command] [options]

COMMANDS:
  full                          # Full cleanup (default)
  delete-group [group-id]       # Delete specific consumer group
  reset-offsets [group-id]      # Reset consumer offsets to earliest
  reset-latest [group-id]       # Reset consumer offsets to latest
  clean-stale                   # Remove stale/dead consumer groups

OPTIONS:
  --help, -h                    # Show this help message
  --force                       # Skip confirmation prompts
  --dry-run                     # Show what would be done without executing

EXAMPLES:
  node config/cleanup-kafka.js                           # Full cleanup
  node config/cleanup-kafka.js delete-group my-group     # Delete specific group
  node config/cleanup-kafka.js reset-offsets             # Reset default group to earliest
  node config/cleanup-kafka.js clean-stale --dry-run     # Preview stale cleanup

INTEGRATION:
  npm run kafka:cleanup                                   # Via package.json script

⚠️  WARNING: This will delete consumer groups and reset offsets!
   Make sure you understand the implications before running.
`);
    process.exit(0);
  }

  const cleanup = new KafkaCleanup();
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  const command = args[0] || "full";

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No actual changes will be made");
    console.log("=".repeat(50));
  }

  if (!isForce && !isDryRun) {
    console.log(
      "⚠️  WARNING: This will modify Kafka consumer groups and offsets!"
    );
    console.log("   Use --force to proceed or --dry-run to preview changes");
    console.log("   Add --help for more information");
    process.exit(1);
  }

  try {
    if (isDryRun) {
      console.log(`📋 Would execute: ${command}`);
      console.log(
        "🎯 Target consumer group:",
        cleanup.serviceConfig.consumerGroup
      );
      console.log("📋 Target topics:", cleanup.serviceConfig.topics.join(", "));
      console.log("✅ Dry run completed - no changes made");
      return;
    }

    switch (command) {
      case "full":
        await cleanup.fullCleanup();
        break;
      case "delete-group":
        const groupId = args[1];
        await cleanup.connect();
        await cleanup.deleteConsumerGroup(groupId);
        await cleanup.disconnect();
        break;
      case "reset-offsets":
        const resetGroupId = args[1];
        await cleanup.connect();
        await cleanup.resetConsumerOffsets(resetGroupId, "earliest");
        await cleanup.disconnect();
        break;
      case "reset-latest":
        const latestGroupId = args[1];
        await cleanup.connect();
        await cleanup.resetConsumerOffsets(latestGroupId, "latest");
        await cleanup.disconnect();
        break;
      case "clean-stale":
        await cleanup.connect();
        await cleanup.cleanupStaleConsumers();
        await cleanup.disconnect();
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("   Use --help for available commands");
        process.exit(1);
    }
  } catch (error) {
    console.error("💥 Unexpected error during Kafka cleanup:", error.message);
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

module.exports = KafkaCleanup;
