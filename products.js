function main() {
    var currentDate = new Date();
    var pastDate = new Date();
    pastDate.setDate(currentDate.getDate() - 365);
    var toDate = Utilities.formatDate(currentDate, 'GMT', 'yyyyMMdd');
    var fromDate = Utilities.formatDate(pastDate, 'GMT', 'yyyyMMdd');
    try {
        var shoppingCampaigns = AdsApp.shoppingCampaigns().withCondition("Status = ENABLED").get();
        while (shoppingCampaigns.hasNext()) {
            var campaign = shoppingCampaigns.next();
            processAdGroups(campaign.adGroups(), "Shopping", campaign.getName(), fromDate, toDate);
        }
    } catch (e) {
        Logger.log("Error: " + e.toString());
    }
}

function processAdGroups(adGroupIterator, campaignTypeName, campaignName, fromDate, toDate) {
    adGroupIterator = adGroupIterator.withCondition("Status = ENABLED").get();
    while (adGroupIterator.hasNext()) {
        var adGroup = adGroupIterator.next();

        var reportType = "SHOPPING_PERFORMANCE_REPORT";
        var totalConversionsReport = AdsApp.report(
            "SELECT Conversions " +
            "FROM " + reportType + " " +
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
                "SELECT OfferId, Cost, Conversions, Clicks " +
                "FROM " + reportType + " " +
                "WHERE AdGroupId = " + adGroup.getId() + " " +
                "AND Conversions > 0 " +
                "DURING " + fromDate + "," + toDate
            );

            var rows = report.rows();
            var totalSpendForConvertingItems = 0;
            var totalConversions = 0;
            var totalClicksForConvertingItems = 0;

            while (rows.hasNext()) {
                var row = rows.next();
                totalSpendForConvertingItems += parseFloat(row['Cost'].replace(/,/g, ''));
                totalConversions += parseInt(row['Conversions']);
                totalClicksForConvertingItems += parseInt(row['Clicks']);
            }

            var itemsToHighlight = [];
            if (totalConversions > 0) {
                var averageCostPerConversion = totalSpendForConvertingItems / totalConversions;
                var averageClicksPerConversion = totalClicksForConvertingItems / totalConversions;
                
                report = AdsApp.report(
                    "SELECT OfferId, Cost, Conversions, Clicks " +
                    "FROM " + reportType + " " +
                    "WHERE AdGroupId = " + adGroup.getId() + " " +
                    "AND Conversions = 0 " +
                    "DURING " + fromDate + "," + toDate
                );
                rows = report.rows();
                while (rows.hasNext()) {
                    var row = rows.next();
                    var cost = parseFloat(row['Cost'].replace(/,/g, ''));
                    var clicks = parseInt(row['Clicks']);

                    if (cost > averageCostPerConversion || clicks > averageClicksPerConversion) {
                        itemsToHighlight.push(row['OfferId']);
                    }
                }
            }

            var excludedItemIds = getExcludedItemIds(adGroup);
            itemsToHighlight = itemsToHighlight.filter(function(itemId) {
                return !excludedItemIds.includes(itemId);
            });

            if (itemsToHighlight.length > 0) {
                var itemsString = itemsToHighlight.join(", ");
                Logger.log(new Date().toLocaleString() + "\tCampaign: " + campaignName + "\nAd Group: " + adGroup.getName() + "\nItem IDs to potentially exclude: " + itemsString);
            }
        }
    }
}

function getExcludedItemIds(adGroup) {
    var excludedItemIds = [];
    var productGroups = adGroup.productGroups().get();
    while (productGroups.hasNext()) {
        var productGroup = productGroups.next();
        if (productGroup.isExcluded()) {
            var productGroupString = productGroup.getValue();
            var itemIdMatch = productGroupString.match(/.*\bid=(\d+).*$/);
            if (itemIdMatch && itemIdMatch.length > 1) {
                excludedItemIds.push(itemIdMatch[1]);
            }
        }
    }
    return excludedItemIds;
}
