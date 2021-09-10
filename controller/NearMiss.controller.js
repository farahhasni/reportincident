sap.ui.define([
	"Sempra/EHS/Incident/controller/IncidentBaseController"
], function (IncidentBaseController) {
	"use strict";

	return IncidentBaseController.extend("Sempra.EHS.Incident.controller.NearMiss", {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf Sempra.EHS.Incident.view.
		 */
		onInit: function () {
			this.getRouter().getRoute("NearMiss").attachMatched(this.onLoadNearMiss, this);
		},
		
		/**
		 * This method is fired whenever the user navigates to this view via the app router.
		 */
		onLoadNearMiss: function(oEvent) {
			// Load the near miss record into context:			
			var mArgs = oEvent.getParameter("arguments");
			var oIncident = null;
			var sPath = "/Incidents/";
			
			if (mArgs && mArgs.incidentKey) {
				// Fetch the pre-existing near miss record into context:
				// TODO:
			}
			else {
				// Create a new near miss record:
				oIncident = this.createNewIncident("002");
				oIncident.NmGroup = this.IncidentSubCategories.get("NearMiss");
				sPath += this.addIncidentToModel(oIncident);				
			}
			
			// Initialize the form:
			this.getView().bindElement({
				path: sPath
			});
			
			this.resetForm();
		},
		
		/**
		 * This method is used to initialize the input form.
		 */
		resetForm: function() {
			this.getView().byId("rateRiskTitle").setText("In your opinion, how would you rate the risk of the Near Miss / Close Call being submitted?");
			this.getView().byId("inpEHSLocationUUID").setValue("");
			this.getView().byId("inpIncidentUTCDateTime").setMaxDate(new Date());
		}
	});
});