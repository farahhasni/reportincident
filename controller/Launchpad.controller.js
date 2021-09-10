sap.ui.define([
	"Sempra/EHS/Incident/controller/IncidentBaseController",
	"sap/m/MessageBox",
	"sap/ui/core/IconPool",
	"sap/m/GenericTile",
	"sap/m/TileContent",
	"sap/m/ImageContent"
], function (IncidentBaseController, MessageBox, IconPool, GenericTile, TileContent, ImageContent) {
	"use strict";

	return IncidentBaseController.extend("Sempra.EHS.Incident.controller.Launchpad", {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf Sempra.EHS.Incident.view.Launchpad
		 */
		onInit: function () {
			// Load Fiori 2 icons in offline mode:
			IconPool.addIcon('F0316', 'Fiori2', 'Fiori2', 'E227');
			
			// Load the tiles from the app model:
			var aTiles = this.getModel("app").getProperty("/Tiles");
					
			aTiles.forEach(function(oTile) {
				if (oTile.Visible) {
					this.addTile(oTile);
				}
			}.bind(this));
			
			// Add the worklist tile to the end of the list:
			this.addTile({
				Target: "Worklist",
				TileName: "Worklist",
				TileSubName: "Sync to EHSM",
				Icon: "sap-icon://refresh"
			});
			
			// Check to see if the user has records queued up to process:
			if (window.navigator.onLine) {
				this.IDBUtils.hasUnsubmittedIncident()
				.then((bResult) => {
					if (bResult) {
						MessageBox.confirm("You have event records that haven't been sent to SAP - would you like to sync them now?", {
							title: this.appTitle,
							onClose: function(oAction) {
								if (oAction === MessageBox.Action.OK) {
									// Take the user over to the worklist to trigger a sync-up:
									this.getRouter().navTo("Worklist");
								}
							}.bind(this)
						});
					}
				});
			}
		},
		
		/**
		 * This method is used to add a tile to the landing page layout.
		 */
		addTile: function(tile) {
			var parenttile = new GenericTile(tile.Target, {
				header: tile.TileName,
				subheader: tile.TileSubName ? tile.TileSubName : "",
				press: this.onPressGeneric.bind(this)
			});
			
			var tilecontent = new TileContent();
			
			var imgContent = new ImageContent("", {
				src: tile.Icon ? tile.Icon : "sap-icon://incident"
			});
			
			tilecontent.setContent(imgContent);
			parenttile.addTileContent(tilecontent);
			parenttile.addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginTop");
			
			this.getView().byId("gridcontainer").addItem(parenttile);
		},
		
		/**
		 * This event handler method is used to process a press event on a custom tile.
		 */
		onPressGeneric: function(oEvent) {
			var oSelectedItem = oEvent.getSource();
			var targets = Object.keys(this.getRouter().getTargets()._mTargets);
    		
    		// find the appropriate route and then GO
    		var tmp = targets.find(function(tile) {
    			return oSelectedItem.getId().includes(((tile).replace(/\W/g, "")));
    		});
    		
    		this.getRouter().navTo(tmp);
		},
		
		/**
		 * This method is used to trigger navigation to the worklist view.
		 */
		onPressWorklist: function(oEvent) {
			this.getRouter().navTo('Worklist');
		}
	});
});