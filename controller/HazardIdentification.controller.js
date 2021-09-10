sap.ui.define([
	"Sempra/EHS/Incident/controller/IncidentBaseController"
], function (IncidentBaseController) {
	"use strict";

	return IncidentBaseController.extend("Sempra.EHS.Incident.controller.HazardIdentification", {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf Sempra.EHS.Incident.view.HazardIndication
		 */
		onInit: function () {
			this.getRouter().getRoute("HazardIdentification").attachMatched(this.onLoadIndication, this);
		},
		
		/**
		 * This method is fired whenever the user navigates to this view via the app router.
		 */
		onLoadIndication: function(oEvent) {
			// Load the hazard indication record into context:			
			var mArgs = oEvent.getParameter("arguments");
			var oIncident = null;
			var sPath = "/Incidents/";
			
			if (mArgs && mArgs.incidentKey) {
				// Fetch the pre-existing hazard indication record into context:
				// TODO:
			}
			else {
				// Create a new hazard indication record:
				oIncident = this.createNewIncident("003");
				oIncident.SftyObsGroup = this.IncidentSubCategories.get("HazardIndentification");
				sPath += this.addIncidentToModel(oIncident);
			}
			
			// Initalize the form:
			this.getView().bindElement({
				path: sPath
			});
			
			this.resetForm();
		},
		
		/**
		 * This method is used to reset the input form.
		 */
		resetForm: function() {
			this.getView().byId("idDateTimePicker").setMaxDate(new Date());
			var oInput = this.getView().byId("inpEHSLocationUUID");
			if (oInput) {
				oInput.setValue("");
			}
		}
	});
});