sap.ui.define([], function () {
  "use strict";

  return {
    subCategoryDesc: function (category, nmGroup, sftyObsGroup,incidentGroup) {
      switch (category) {
        case "001":
          switch (incidentGroup) {
            case "EHHSS_IGR_OCC_INC" || "ZEHHSS_IGR_MVI":
              return "Report Incident";
          }
          break;
        case "002":
          switch (nmGroup) {
            case "ZEHHSS_NMG_NM_CC":
              return "Near Miss / Close Call";
            case "ZEHHSS_NMG_STOP_WORK":
              return "Stop the Job";
            default:
              return "(Unknown)";
          }

          break;
        case "003":
          switch (sftyObsGroup) {
            case "ZEHHSS_SOG_SFTY_SUG":
              return "Safety Suggestion";
            case "ZEHHSS_SOG_HAZARD_ID":
              return "Hazard Identification";
            default:
              return "(Unknown)";
          }

          break;
      }
    },

    statusDesc: function (incidentId, incidentStatus) {
      switch (incidentStatus) {
        case "01":
          try {
            var nFormatted = parseInt(incidentId, 10);
            return nFormatted.toString();
          } catch (err) {
            return "Posted";
          }
        case "99":
          return "Error";
        default:
          return "Pending";
      }
    },
  };
});
