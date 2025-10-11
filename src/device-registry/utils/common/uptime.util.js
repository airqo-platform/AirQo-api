const getUptimeAccuracyUpdateObject = ({
  isCurrentlyOnline,
  isNowOnline,
  currentStats = {}, // Pass the existing accuracy object
  reason,
}) => {
  const isTruthful = isCurrentlyOnline === isNowOnline;

  // --- New "Truthfulness" Logic ---
  const currentTotalChecks = currentStats.totalChecks || 0;
  const currentCorrectChecks = currentStats.correctChecks || 0;
  const currentIncorrectChecks = currentStats.incorrectChecks || 0;

  const newTotalChecks = currentTotalChecks + 1;
  const newCorrectChecks = isTruthful
    ? currentCorrectChecks + 1
    : currentCorrectChecks;
  const newIncorrectChecks = isTruthful
    ? currentIncorrectChecks
    : currentIncorrectChecks + 1;

  const accuracyPercentage =
    newTotalChecks > 0 ? (newCorrectChecks / newTotalChecks) * 100 : 0;

  // --- Backward Compatibility Logic ---
  const newTotalAttempts = newTotalChecks;
  const newSuccessfulUpdates = newCorrectChecks;
  const newFailedUpdates = newIncorrectChecks;
  const successPercentage = accuracyPercentage;
  const failurePercentage = 100 - accuracyPercentage;

  const incUpdate = {
    // New fields
    "onlineStatusAccuracy.totalChecks": 1,
    ...(isTruthful
      ? { "onlineStatusAccuracy.correctChecks": 1 }
      : { "onlineStatusAccuracy.incorrectChecks": 1 }),
    // Old fields
    "onlineStatusAccuracy.totalAttempts": 1,
    ...(isTruthful
      ? { "onlineStatusAccuracy.successfulUpdates": 1 }
      : { "onlineStatusAccuracy.failedUpdates": 1 }),
  };

  const setUpdate = {
    // New fields
    "onlineStatusAccuracy.lastCheck": new Date(),
    "onlineStatusAccuracy.accuracyPercentage": accuracyPercentage,
    ...(isTruthful
      ? { "onlineStatusAccuracy.lastCorrectCheck": new Date() }
      : {
          "onlineStatusAccuracy.lastIncorrectCheck": new Date(),
          "onlineStatusAccuracy.lastIncorrectReason": reason,
        }),
    // Old fields
    "onlineStatusAccuracy.lastUpdate": new Date(),
    "onlineStatusAccuracy.successPercentage": successPercentage,
    "onlineStatusAccuracy.failurePercentage": failurePercentage,
    ...(isTruthful
      ? { "onlineStatusAccuracy.lastSuccessfulUpdate": new Date() }
      : { "onlineStatusAccuracy.lastFailureReason": reason }),
  };

  return { setUpdate, incUpdate };
};

module.exports = { getUptimeAccuracyUpdateObject };
