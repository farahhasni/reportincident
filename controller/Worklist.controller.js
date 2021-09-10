sap.ui.define([
	"Sempra/EHS/Incident/controller/IncidentBaseController",
	"sap/ui/model/json/JSONModel",
	"Sempra/EHS/Incident/controller/Formatter",
	"sap/ui/model/Filter",
	"sap/m/MessageBox"
], function (IncidentBaseController, JSONModel, Formatter, Filter, MessageBox) {
	"use strict";
	
	return IncidentBaseController.extend("Sempra.EHS.Incident.controller.Worklist", {
		formatter: Formatter,

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf Sempra.EHS.Incident.view.Worklist
		 */
		onInit: function () {
			this.getRouter().getRoute("Worklist").attachMatched(this.onLoadWorklist, this);
		},
		
		/**
		 * This method is used to load the worklist table.
		 */
		onLoadWorklist: function(oEvent) {
			// Load the worklist from the IDB data store:
			return this.clearOldEvents()
			.then(function() {
				return this.IDBUtils.getAllIncidentsFromIDB('incidentstore');
			}.bind(this))
			.then(function(incidents) {
				this.getModel().setProperty("/Worklist", incidents);
			}.bind(this))
			.catch(function(err) { 
				MessageBox.error("An unexpected error occurred while loading records into the worklist");
			}.bind(this));
		},
		
		/**
		 * This method is used to filter the worklist.
		 */
		onFilterWorklist: function(oEvent) {
			var selectedkey = oEvent.getParameter("selectedKey");
			var aFilters = [];
			
			if (selectedkey === this.IncidentStatus.Pending) {
				selectedkey = "";
			}
			
			if (selectedkey !== "all") {
				aFilters.push(new Filter("IncidentStatus", "EQ", selectedkey));	
			}
			
			this.byId("tabWorklist").getBinding("items").filter(aFilters);
		},
		
		/**
		 * This method is used to coordinate the synchronization of offline records back to SAP.
		 */
		onSyncToSAP: function(oEvent) {
			// Make sure the user is online:
			if (!navigator.onLine) {
				MessageBox.error("Network connection is not available - please try again later");
				return;
			}

			// Open up a busy dialog to block the screen:
			var oDialog = this.byId("BusyDialog");
			oDialog.open();
			
			// Create a process to upload multiple records back to SAP using this.saveIncident(oIncident, counter):
			var aIncidents = this.getModel().getProperty("/Worklist").filter(function(incident) { return incident.IncidentStatus === this.IncidentStatus.Draft || incident.IncidentStatus === this.IncidentStatus.Pending; }.bind(this));
			
			// First, get all attachments from IDB:
			return this.IDBUtils.getAllIncidentsFromIDB('attachmentstore')
			.then((attachments) => {
				// Next, we need to loop over the incidents and match up respective attachments:
				var mappedIncidents = aIncidents.map(function(incident) {
					incident.Attachments = attachments.filter(function(attachment) {
						return attachment.ParentUUID === incident.UUID;
					});
					
					return incident;
				});
				
				return mappedIncidents;
			})
			.then((mappedIncidents) => {
				// Now we need to post these incidents with Promise.all:
				return Promise.all(mappedIncidents.map(function(incident, i) {
					return this.saveIncident(incident);
				}.bind(this)))
				.then((aResponses) => {
					// Close the busy wait dialog:
					oDialog.close();

					// Scan for errors:
					var errorCount = 0;
					for (var i = 0; i < aResponses.length; i++) {
						var oResponse = aResponses[i];
						if (oResponse.HasErrors) {
							errorCount += 1;
						}
					}
	
					// Respond accordingly:
					if (errorCount === 0) {
						this.refreshWorklist();
					
						MessageBox.success("All your records were successfully synchronized.");
					}
					else {
						MessageBox.error("Some records were unable to be saved to SAP. Please try again.");	
					}
				})
				.catch((ex) => {
					oDialog.close();
					MessageBox.error("Some records were unable to be saved to SAP. Please try again.");					
				});
			})
			.catch(function(err) {
				MessageBox.error("Some records were unable to be saved to SAP. Please try again.");
				oDialog.close();
			}.bind(this));
		},

		refreshWorklist: function() {
			// Query the incident store to grab the updated records:
			this.IDBUtils.getAllIncidentsFromIDB('incidentstore')
			.then((incidents) => {
				// Now, refresh the model with the updated data:
				this.getModel().setProperty("/Worklist", incidents);

				var oTable = this.byId('tabWorklist');
				oTable.getBinding("items").refresh();
			})
			.catch((err) => { 
				MessageBox.error("An unexpected error occurred while loading records into the worklist");
			});
		},
		
		/**
		 * This method is used to display a message log for the user so that they can look at the issues for a given record.
		 */
		onOpenMessageLog: function(oEvent) {
			// Fetch the selected event record:
			var oTable = this.getView().byId("tabWorklist");
			var oItem = oTable.getSelectedItem();
			
			if (! oItem) {
				MessageBox.show("You must select an event record first", {
					title: this.appTitle
				});
				
				return;
			}
			
			var oIncident = oItem.getBindingContext().getObject();
			
			// Display the message log: 
			var message = "Event Submission Log:\n\n";
			oIncident.MessageLog.forEach(function(msg) {
				message = message + "\n" + msg;
			});
			
			MessageBox.show(message, {
				title: this.appTitle
			});
		},
		
		/**
		 * This method is used to process deletion requests for cached records.
		 */
		onDeleteEvent: function(oEvent) {
			// Fetch the selected event record:
			var oTable = this.getView().byId("tabWorklist");
			var oItem = oTable.getSelectedItem();
			
			if (! oItem) {
				MessageBox.show("You must select an event record first", {
					title: this.appTitle
				});
				
				return;
			}
			
			var oIncident = oItem.getBindingContext().getObject();
			
			// Make sure the incident hasn't already been sent to SAP:
			if (oIncident.IncidentStatus === this.IncidentStatus.New) {
				MessageBox.show("This event record has already been sent to SAP - you cannot delete it here.", {
					title: this.appTitle
				});
				
				return;
			}
			
			// If we get to here, we're ready to move forward:
			MessageBox.confirm("Are you sure you want to delete the event record?", {
				title: this.appTitle,
				
				onClose: function(oAction) {
					if (oAction === sap.m.MessageBox.Action.OK)	{
						// If the user approves, then we can go ahead and remove the incident record.
						// First, remove it from the worklist model:
						var aIncidents = this.getModel().getProperty("/Worklist");
			
						for (var i = 0; i < aIncidents.length; i++) {
							if (aIncidents[i].UUID === oIncident.UUID) {
								aIncidents.splice(i, 1);
								break;
							}
						}
						
						this.getModel().setProperty("/Worklist", aIncidents);
						
						// Next, remove it from IDB storage:
						this.IDBUtils.deleteIDBRecord("incidentstore", oIncident.UUID)
						.then(function() {
							this.IDBUtils.getAllAttachmentsByIncidentFromIDB("attachmentstore", oIncident.UUID)
							.then(function(aAttachments) {
								aAttachments.map(function(attachment) {
									return this.IDBUtils.deleteIDBRecord('attachmentstore', attachment.UUID);
								}.bind(this));
							}.bind(this))
							.catch(function(attachErr) {
								MessageBox.error("An unexpected error occurred while trying to delete the event record");
							}.bind(this));
						})
						.catch(function(err) {
							MessageBox.error("An unexpected error occurred while trying to delete the event record");
						});
					}
				}.bind(this)
			});
		}
	});
});