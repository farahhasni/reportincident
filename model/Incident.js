sap.ui.define(["sap/ui/base/Object"], function (UI5Object) {
  "use strict";

  return UI5Object.extend("Sempra.EHS.Incident.model.Incident", {
    // Incident attributes:
    UUID: "",
    IncidentUUID: "",
    IncidentID: "",
    IncidentCategory: "",
    IncidentStatus: "",
    IncidentDescriptionOfEvents: "",
    IncidentTitle: "",
    IncidentCreationUTCDateTime: new Date(),
    IncidentUTCDateTime: new Date(),
    IncidentTimeIsUnknown: false,
    EHSLocationUUID: "",
    IncidentLocationDescription: "",
    IncidentManagerFullName: "",
    IncidentManagerEmailAddress: "",
    IncidentManagerPhoneNumber: "",
    MigrationSrc: "",
    LocType: "",
    NmGroup: "",
    ImpCustomer: false,
    ImpPublic: false,
    ImpEmployee: false,
    ImpOther: false,
    ImpOtherDesc: "",
    PrimCause: "",
    PrimOthDesc: "",
    SecCause: "",
    SecOthDesc: "",
    SafetyExpComments: "",
    OrgConstruction: false,
    OrgElectric: false,
    OrgElectricTrans: false,
    OrgEnergy: false,
    OrgEnvironmental: false,
    OrgFacilities: false,
    OrgFleet: false,
    OrgGasCustSvc: false,
    OrgGasDist: false,
    OrgGasStorage: false,
    OrgGasTrans: false,
    OrgMajorProj: false,
    OrgOfficeEmp: false,
    OrgSafety: false,
    OrgOther: false,
    OrgOtherDesc: "",
    RepAnonymInd: false,
    RepPerId: "",
    RepPerName: "",
    RepPerEmail: "",
    RepPerTelNum: "",
    EstRiskType: "",
    Resolution: "",
    ACFHazard: false,
    ACFAtRisk: false,
    ACFManagement: false,
    HIDCatHealth: false,
    HIDCatSafety: false,
    HIDCatEnv: false,
    HIDCatOther: false,
    HIDCatOtherDesc: "",
    CorrectHazard: "",
    ResolvedYes: false,
    ResolvedNo: false,
    ResExplain: "",
    HrRepLoc: "",
    HrRepOrgUnit: "",
    SftyObsGroup: "",
    Originator: "",
    Attachments: [],
    MessageLog: [],
    //Report Incident
    AccidentCatFlag: false,
    AccidentCat: "",
    MviIncidentFlag : false,
    CompanyLocation: "",
    VehicleCompanyOwned: "",
    VehicleUnitNo: "",
    LicensePlateID: "",
    InjPerID: "",
    VehDrivID: "",
    WitnessID: "",





    // IncidentGroup: " ",
    // SelectInjIllnessInd: false,
    // AccidentCat: "",
    // SelectMviInd: false,
    // MviType: "",
    // IncidentDesc: "",
    // DetailedDescription: "",
    // NameInjured: "",
    // InjuredPersNum: "",
    // IncidentDriver: "",
    // IncidentPersNum: "",
    // SelectVehicleInd: false,
    // VehUnit: "",
    // VehLicenseNo: "",
    // WitnessName: "",
    // IncidentWitnessPersNum: "",

    /**
     * Constructor method used to model an incident in SAP EHSM
     *
     * @class
     * @param {string} incidentCategory
     * @param {boolean} isPWA
     */
    constructor: function (incidentCategory, isPWA = true) {
      var uuid = this.generateUUID();
      var migrationSrc = isPWA ? "EHSM_PWA_" + this.getDateSignature() : "";

      this.UUID = this.IncidentUUID = uuid;
      this.IncidentCategory = incidentCategory;
      this.IncidentCreationUTCDateTime = new Date();
      this.IncidentUTCDateTime = new Date();
    },

    /**
     * This method is used to set the group assignment for the incident instance.
     *
     * @param {string} sGroup
     */
    setGroup: function (sGroup) {
      switch (this.IncidentCategory) {
        case "001": // Incident
        this.IncidentGrp = sGroup; 
          break;
        case "002": // Near Miss
          this.NmGroup = sGroup;
          break;
        case "003": // Safety Observation
          this.SftyObsGroup = sGroup;
          break;
      }
    },

    /**
     * This method is used to dynamically generate a UUID.
     */
    generateUUID: function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (sMatch) {
          // generate a random integer between 0 (inclusive) and 16 (exclusive)
          var iRandom = (Math.random() * 16) | 0;
          // - x & 0x3 is equivalent to x % 3
          // - x | 0x8 is equivalent to x + 8
          var sGuid = sMatch === "x" ? iRandom : (iRandom & 0x3) | 0x8;
          return sGuid.toString(16);
        }
      );
    },

    /**
     * This method is used to derive a date/time stamp value for signatures.
     */
    getDateSignature: function () {
      function pad2(n) {
        return (n < 10 ? "0" : "") + n;
      }

      var d = new Date();

      return (
        d.getFullYear() +
        pad2(d.getMonth() + 1) +
        pad2(d.getDate()) +
        "_" +
        pad2(d.getHours()) +
        pad2(d.getMinutes()) +
        pad2(d.getSeconds())
      );
    },
  });
});
