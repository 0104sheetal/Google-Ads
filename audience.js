function main() {
  var currentDate = new Date();
  var pastDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());
  var toDate = Utilities.formatDate(currentDate, 'GMT', 'yyyyMMdd');
  var fromDate = Utilities.formatDate(pastDate, 'GMT', 'yyyyMMdd');
  
  Logger.log("Script execution started for the period: " + fromDate + " to " + toDate);

  var campaigns = AdsApp.campaigns().withCondition('Status = ENABLED').get();
  if (!campaigns.hasNext()) {
    Logger.log("No enabled campaigns found.");
    return;
  }
  
  while (campaigns.hasNext()) {
    var campaign = campaigns.next();
    Logger.log("Processing Campaign: " + campaign.getName());
    var adGroupIterator = campaign.adGroups().get();
    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      Logger.log("Processing Ad Group: " + adGroup.getName());
      var criteriaIterator = adGroup.targeting().audiences().get();
      while (criteriaIterator.hasNext()) {
        var audience = criteriaIterator.next();
        try {
          adjustBidOrExclude(audience, fromDate, toDate);
        } catch (e) {
          Logger.log("Error adjusting bids for Audience ID: " + audience.getCriterion().getId() + " - " + e.message);
        }
      }
    }
  }
}

function adjustBidOrExclude(audience, fromDate, toDate) {
  var criterionId = audience.getCriterion().getId();
  var reportQuery = 'SELECT CriteriaId, ConversionValue, Cost, Clicks, Conversions ' +
                    'FROM AUDIENCE_PERFORMANCE_REPORT ' +
                    'WHERE AdGroupId = ' + audience.getAdGroup().getId() + ' ' +
                    'AND CriteriaId = ' + criterionId + ' ' +
                    'DURING ' + fromDate + ',' + toDate;
  var report = AdsApp.report(reportQuery);
  var rows = report.rows();
  
  while (rows.hasNext()) {
    var row = rows.next();
    var convValue = parseFloat(row['ConversionValue']);
    var cost = parseFloat(row['Cost']);
    var clicks = parseInt(row['Clicks']);
    var conversions = parseInt(row['Conversions']);
    var valueCostRatio = cost > 0 ? convValue / cost : 0;
    var averageCostPerConversion = conversions > 0 ? cost / conversions : 0;
    var averageClicksPerConversion = conversions > 0 ? clicks / conversions : 0;

    Logger.log("Audience ID: " + criterionId +
               ", Conversion Value/Cost Ratio: " + valueCostRatio.toFixed(2) +
               ", Average Cost Per Conversion: " + averageCostPerConversion.toFixed(2) +
               ", Average Clicks Per Conversion: " + averageClicksPerConversion.toFixed(2));

    if (valueCostRatio > 3) {
      audience.bidding().setBidModifier(1.6);
    } else if (valueCostRatio >= 2.5 && valueCostRatio <= 3) {
      audience.bidding().setBidModifier(1.4);
    } else if (valueCostRatio >= 2 && valueCostRatio < 2.5) {
      audience.bidding().setBidModifier(1.25);
    } else if (valueCostRatio >= 1.75 && valueCostRatio < 2) {
      audience.bidding().setBidModifier(1.1);
    } else if (valueCostRatio >= 1.5 && valueCostRatio < 1.75) {
      audience.bidding().setBidModifier(1.05);
    } else if (valueCostRatio >= 0.75 && valueCostRatio < 1.5) {
      audience.bidding().setBidModifier(0.8);
    } else if (valueCostRatio < 0.5) {
      Logger.log("Excluding Audience ID: " + criterionId +
                 " due to low Conv Value/Cost Ratio.");
      audience.exclude();
    }
  }
}
