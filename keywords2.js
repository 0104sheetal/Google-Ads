function main() {
  Logger.log("Script started executing");
  var currentDate = new Date();
  var pastDate = new Date();
  pastDate.setDate(currentDate.getDate() - 365);

  var toDate = Utilities.formatDate(currentDate, 'GMT', 'yyyyMMdd');
  var fromDate = Utilities.formatDate(pastDate, 'GMT', 'yyyyMMdd');

  try {
    var regularCampaigns = AdsApp.campaigns().withCondition("Status = ENABLED").get();
    Logger.log("Processing regular campaigns");
    while (regularCampaigns.hasNext()) {
      var campaign = regularCampaigns.next();
      processAdGroups(campaign.adGroups(), "Regular", campaign.getName(), fromDate, toDate);
    }

    var shoppingCampaigns = AdsApp.shoppingCampaigns().withCondition("Status = ENABLED").get();
    Logger.log("Processing shopping campaigns");
    while (shoppingCampaigns.hasNext()) {
      var campaign = shoppingCampaigns.next();
      processAdGroups(campaign.adGroups(), "Shopping", campaign.getName(), fromDate, toDate);
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

function processAdGroups(adGroupIterator, campaignTypeName, campaignName, fromDate, toDate) {
  Logger.log("Started processing Ad Groups for Campaign: " + campaignName);
  adGroupIterator = adGroupIterator.withCondition("Status = ENABLED").get();

  while (adGroupIterator.hasNext()) {
    var adGroup = adGroupIterator.next();
    Logger.log("Processing Ad Group: " + adGroup.getName());

    var totalConversionsReport = AdsApp.report(
      "SELECT Conversions " +
      "FROM ADGROUP_PERFORMANCE_REPORT " +
      "WHERE AdGroupId = " + adGroup.getId() + " " +
      "DURING " + fromDate + "," + toDate
    );

    var totalConversions = 0;
    var rows = totalConversionsReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      totalConversions += parseInt(row['Conversions']);
    }

    if (totalConversions > 20) {
      var report = AdsApp.report(
        "SELECT Query, Cost, Conversions, Clicks, ConversionValue " +
        "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
        "WHERE AdGroupId = " + adGroup.getId() + " " +
        "DURING " + fromDate + "," + toDate
      );
      rows = report.rows();
      var totalSpendForConvertingSearchTerms = 0;
      var totalConversions = 0;
      var totalClicksForConvertingSearchTerms = 0;
      var totalConversionValue = 0;

      while (rows.hasNext()) {
        var row = rows.next();
        totalSpendForConvertingSearchTerms += parseFloat(row['Cost'].replace(/,/g, ''));
        totalConversions += parseInt(row['Conversions']);
        totalClicksForConvertingSearchTerms += parseInt(row['Clicks']);
        if ('ConversionValue' in row) {
          totalConversionValue += parseFloat(row['ConversionValue'].replace(/,/g, ''));
        }
      }

      var searchTermsToNegate = [];
      if (totalConversions > 0) {
        var averageCostPerConversion = totalSpendForConvertingSearchTerms / totalConversions;
        var averageClicksPerConversion = totalClicksForConvertingSearchTerms / totalConversions;
        Logger.log("Average Cost per Conversion: " + averageCostPerConversion);
        Logger.log("Average Clicks per Conversion: " + averageClicksPerConversion);

        var roas = totalConversionValue / totalSpendForConvertingSearchTerms;

        if (roas < 1.5) {
          rows = report.rows();
          while (rows.hasNext()) {
            var row = rows.next();
            var cost = parseFloat(row['Cost'].replace(/,/g, ''));
            var clicks = parseInt(row['Clicks']);

            if (cost > 2 * averageCostPerConversion || clicks > 2 * averageClicksPerConversion) {
              if (!isNegativeKeyword(adGroup, row['Query'])) {
                searchTermsToNegate.push(row['Query']);
              }
            }
          }
        }
      }

      if (searchTermsToNegate.length > 0) {
        var keywordsString = searchTermsToNegate.map(function(keyword) {
          return "[" + keyword + "]";
        }).join("\n");
        Logger.log("Keywords to be negated: \n" + keywordsString);
      }
    } else {
      Logger.log("Ad Group: " + adGroup.getName() + " has less than 20 conversions.");
    }
  }
  Logger.log("Completed processing for Campaign: " + campaignName);
}

function isNegativeKeyword(adGroup, term) {
  var negativeKeywords = adGroup.negativeKeywords().get();
  while (negativeKeywords.hasNext()) {
    var negativeKeyword = negativeKeywords.next();
    if (negativeKeyword.getText() === term) {
      return true;
    }
  }
  return false;
}
