function main() {
  var currentDate = new Date();
  var pastDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());
  var toDate = Utilities.formatDate(currentDate, 'GMT', 'yyyyMMdd');
  var fromDate = Utilities.formatDate(pastDate, 'GMT', 'yyyyMMdd');
  Logger.log("Script execution started for the period: " + fromDate + " to " + toDate);
  var audienceIterator = AdsApp.targeting().audiences().withCondition("Status = ENABLED").get();
  Logger.log("Processing enabled audiences...");
  while (audienceIterator.hasNext()) {
    var audience = audienceIterator.next();
    adjustAudienceBid(audience, fromDate, toDate);
  }
  Logger.log("Finished processing all audiences.");
}

function adjustAudienceBid(audience, fromDate, toDate) {
  var report = AdsApp.report("SELECT Criteria, Cost, ConversionValue, Conversions, Clicks FROM AUDIENCE_PERFORMANCE_REPORT WHERE AudienceId = " + audience.getId() + " DURING " + fromDate + "," + toDate);
  var rows = report.rows();
  var totalClicks = 0;
  var totalConversions = 0;
  var totalCost = 0;
  var totalConversionValue = 0;
  while (rows.hasNext()) {
    var row = rows.next();
    var cost = parseFloat(row['Cost']);
    var conversionValue = parseFloat(row['ConversionValue']);
    var conversions = parseInt(row['Conversions']);
    var clicks = parseInt(row['Clicks']);
    totalClicks += clicks;
    totalConversions += conversions;
    totalCost += cost;
    totalConversionValue += conversionValue;
  }
  var averageCostPerConversion = totalConversions > 0 ? totalCost / totalConversions : 0;
  var averageClicksPerConversion = totalConversions > 0 ? totalClicks / totalConversions : 0;
  var convValuePerCost = totalCost > 0 ? totalConversionValue / totalCost : 0;
  Logger.log("Audience: " + audience.getId() + ", Conv Value/Cost: " + convValuePerCost.toFixed(2) + ", Average Cost Per Conversion: " + averageCostPerConversion.toFixed(2) + ", Average Clicks Per Conversion: " + averageClicksPerConversion.toFixed(2));
  if (convValuePerCost > 3) {
    audience.bidding().setBidModifier(1.6);
    Logger.log("Bid adjusted to +60%");
  } else if (convValuePerCost >= 2.5) {
    audience.bidding().setBidModifier(1.4);
    Logger.log("Bid adjusted to +40%");
  } else if (convValuePerCost >= 2) {
    audience.bidding().setBidModifier(1.25);
    Logger.log("Bid adjusted to +25%");
  } else if (convValuePerCost >= 1.75) {
    audience.bidding().setBidModifier(1.1);
    Logger.log("Bid adjusted to +10%");
  } else if (convValuePerCost >= 1.5) {
    audience.bidding().setBidModifier(1.05);
    Logger.log("Bid adjusted to +5%");
  } else if (convValuePerCost >= 0.75) {
    audience.bidding().setBidModifier(0.8);
    Logger.log("Bid adjusted to -20%");
  } else if (convValuePerCost < 0.5) {
    excludeAudience(audience);
    Logger.log("Audience excluded due to Conv Value/Cost < 0.5");
  }
}

function excludeAudience(audience) {
  audience.bidding().setBidModifier(0);
  Logger.log("Excluded Audience: " + audience.getId());
}
