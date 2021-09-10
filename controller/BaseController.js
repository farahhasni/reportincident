sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/m/Dialog",
	"sap/m/DialogType",
	"sap/m/Button",
	"sap/m/ButtonType",
	"sap/m/Text",
	"sap/ui/core/routing/History"
], function(Controller, Fragment, Filter, Dialog, DialogType, Button, ButtonType, Text, History) {
	"use strict";

	return Controller.extend("Sempra.EHS.Incident.controller.BaseController", {
		/**
		 * This method is used to fetch the selected model regardless of the request context.
		 */
		getModel: function(sName) {
			if (this.getOwnerComponent()) {
				return this.getOwnerComponent().getModel(sName);
			} else if (this.getView()) {
				return this.getView().getModel(sName);
			} else {
				return undefined;
			}
		},
		
		/**
		 * This method is used to fetch the application's router.
		 */
		getRouter: function() {
			return this.getOwnerComponent().getRouter();
		},
		
		/**
		 * This method is used to take the user "home" regardless of their application context.
		 */
		navigateHome: function() {
			if (sap.ushell && sap.ushell.Container) {
				var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
				if (oCrossAppNav) {
					oCrossAppNav.toExternal({
						target: { semanticObject: "#" }	
					});
				}
			}
			else {
				this.getRouter().navTo("Launchpad", {}, true);
			}
		},
		
		/**
		 * This utility method used to navigate back a page.
		 */
		onNavBack: function() {
			var oHistory = History.getInstance();
			var sPrevHash = oHistory.getPreviousHash();
			
			if (sPrevHash !== undefined && sPrevHash !== "") {
				//window.history.go(-1);
			  window.history.back();
			}
			else {
				var oRouter = this.getRouter();
			  oRouter.navTo("Launchpad", {}, true);
			}
		},
		
		/**
		 * This method is used to show a modal dialog on the screen.
		 */
		showModal: function(oMessage) {
			if (!this.oDefaultMessageDialog) {
				this.oDefaultMessageDialog = new Dialog({
					type: DialogType.Message,
					title: oMessage.title,
					content: new Text({ text: oMessage.text }),
					beginButton: new Button({
						type: ButtonType.Emphasized,
						text: "OK",
						press: function () {
							this.oDefaultMessageDialog.close();
						}.bind(this)
					})
				});
			}

			this.oDefaultMessageDialog.open();	
		},
		
		/**
		 * This method is used to determine whether or not the app is running as a standalone PWA.
		 */
		isPWA: function() {
			var bFLPShell = this.getModel("app").getProperty("/FLPShell");
			if (bFLPShell) {
				return false;
			}

			return true;
		},
		
		/**
		 * This method is used to convert an array buffer into Base 64.
		 */
		arrayBufferToBase64: function(aBuffer) {
			var binary = '';
			var bytes = new Uint8Array(aBuffer);
			var len = bytes.byteLength;
			for (var i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			return window.btoa(binary);
		},
		
		/**
		 * This method is used to dynamically generate a UUID.
		 */
		generateUUID: function (){
		    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(sMatch) {
				// generate a random integer between 0 (inclusive) and 16 (exclusive)
				var iRandom = Math.random() * 16 | 0;
				// - x & 0x3 is equivalent to x % 3
				// - x | 0x8 is equivalent to x + 8
				var sGuid = (sMatch === "x") ? iRandom : (iRandom & 0x3 | 0x8);
				return sGuid.toString(16);
			});
		},
		
		setUseCustomHttpRequest: function(bUse) {
			if (typeof bUse !== "boolean") {
				return;
			}
			if (bUse && window.OData.defaultHttpClient.isCustom !== true) {
				var fnDefaultRequest = window.OData.defaultHttpClient.request;
				window.OData.defaultHttpClient.request = function() {
				    if (arguments[0].headers["Content-Encoding"] === "base64") {
				        arguments[0].body = arguments[0].data;
				    }
				    fnDefaultRequest.apply(this, arguments);
				};
				window.OData.defaultHttpClient.isCustom = true;
				window.OData.defaultHttpClient.defaultRequest = fnDefaultRequest;
			} else if (bUse === false && window.OData.defaultHttpClient.isCustom === true) {
				window.OData.defaultHttpClient.request = window.OData.defaultHttpClient.defaultRequest;
				window.OData.defaultHttpClient.isCustom = false;
			}
		}
		
	});
});