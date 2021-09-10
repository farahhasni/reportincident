sap.ui.define(
  [
    "Sempra/EHS/Incident/controller/IncidentBaseController",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/json/JSONModel",
  ],
  function (
    IncidentBaseController,
    Dialog,
    Button,
    MessageToast,
    MessageBox,
    Fragment,
    Filter,
    JSONModel
  ) {
    "use strict";

    return IncidentBaseController.extend(
      "Sempra.EHS.Incident.controller.ReportIncident",
      {
        /**
         * Called when a controller is instantiated and its View controls (if available) are already created.
         * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
         * @memberOf Sempra.EHS.Incident.view.ReportIncident
         */
        onInit: function () {

          var oViewModel = new JSONModel({
            LocationCompany: 0,
            InjuredPersNum: "",
            IncidentPersNum: "",
            IncidentWitnessPersNum: "",
            DriverName: "",
            InjuredName: "",
            WitnessName: "",
            AccidentCatFlag: true,
            IsVehicleCompanyOwned: false
          });

          // this.getOwnerComponent().setModel(oViewModel,"ReportIncidentView");
          sap.ui.getCore().setModel(oViewModel, "ReportIncidentView");

          this.getRouter()
            .getRoute("ReportIncident")
            .attachMatched(this.onLoadIndication, this);
        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
         * This method is fired whenever the user navigates to this view via the app router.
         */
        onLoadIndication: function (oEvent) {
          // Load the hazard indication record into context:
          var mArgs = oEvent.getParameter("arguments");
          var oIncident = null;
          var sPath = "/Incidents/";
          this.getView().byId("idInjured").setVisible(false);
          this.getView().byId("idDriver").setVisible(false);
          this.getView().byId("idSelectAccidentType").setVisible(false);
          this.getView().byId("idAccidentType").setVisible(false);
          this.getView().byId("idSelectMviType").setVisible(false);
          this.getView().byId("idMviType").setVisible(false);
          this.getView().byId("idAccidentTypeFlag").setSelected(false);
          this.getView().byId("idMviTypeFlag").setSelected(false);
            // this.getView().byId("idSelectMviType").setEnabled(true);
          // this.getView().byId("idSelectAccidentType").setEnabled(true);

          if (mArgs && mArgs.incidentKey) {
            // Fetch the pre-existing hazard indication record into context:
            // TODO:
          } else {
            // Create a new hazard indication record:
            oIncident = this.createNewIncident("001");
            oIncident.IncidentGroup =
              this.IncidentSubCategories.get("ReportIncident");
            sPath += this.addIncidentToModel(oIncident);

            // console.log(this.getModel());
          }

          // Initalize the form:
          this.getView().bindElement({
            path: sPath,
          });

          this.resetForm();
        },

        /**
         * This method is used to reset the input form.
         */
        resetForm: function () {
          this.getView().byId("inpEHSLocationUUID").setValue("");
          this.getView().byId("inpIncidentUTCDateTime").setMaxDate(new Date());
          // var oInput = this.getView().byId("inpEHSLocationUUID");
          // if (oInput) {
          // 	oInput.setValue("");
          // }
        },

        /**
         * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
         * (NOT before the first rendering! onInit() is used for that one!).
         * @memberOf Sempra.EHS.Incident.view.ReportIncident
         */
        //	onBeforeRendering: function() {
        //
        //	},

        /**
         * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
         * This hook is the same one that SAPUI5 controls get after being rendered.
         * @memberOf Sempra.EHS.Incident.view.ReportIncident
         */
        // onAfterRendering: function () {
        // 	this.getView().byId("inpIncidentUTCDateTime").setMaxDate(new Date());
        // 	this.byId("inpIncidentUTCDateTime").setDateValue(new Date());
        // },

        // onHandleChangeDateTime: function (oEvent) {
        // 	var oControl = oEvent.getSource();
        // 	var sValue = oControl.getValue();
        // 	var bValid = new Date(sValue) instanceof Date && !isNaN(new Date(sValue));
        // 	if (!bValid) {
        // 		oControl.setDateValue(new Date());
        // 	}
        // },

        onSelectInjIllness: function (oEvent) {
          var bSelected = oEvent.getParameter("selected");
          if (bSelected) {
            this.getView().byId("idSelectAccidentType").setVisible(true);
            this.getView().byId("idAccidentType").setVisible(true);
            this.getView().byId("idSelectAccidentType").setEnabled(true);
            // sap.ui.getCore().getModel("ReportIncidentView").setProperty("/AccidentCatFlag", false);
            this.getView().byId("idInjured").setVisible(true);
          }
          else {
            this.getView().byId("idSelectAccidentType").setVisible(false);
            this.getView().byId("idAccidentType").setVisible(false);
            this.getView().byId("idSelectAccidentType").setEnabled(false);
            this.getView().byId("idSelectAccidentType").setSelectedKey();
            this.getView().byId("idInjured").setVisible(false);
          }
        },

        onSelectMvi: function (oEvent) {
          var bSelected = oEvent.getParameter("selected");
          if (bSelected) {

            this.getView().byId("idSelectMviType").setVisible(true);
            this.getView().byId("idMviType").setVisible(true);
            this.getView().byId("idSelectMviType").setEnabled(true);
            this.getView().byId("idDriver").setVisible(true);
          } else {

            this.getView().byId("idSelectMviType").setVisible(false);
            this.getView().byId("idMviType").setVisible(false);
            this.getView().byId("idSelectMviType").setEnabled(false);
            this.getView().byId("idDriver").setVisible(false);
          }
        },

        onSelectLocation: function (oEvent) {
          var sSelected = this.getView()
            .byId("idLocation")
            .getSelectedButton()
            .getText(),

            sPath = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getPath();

          if (sSelected === "Company") {
            this.getView().byId("lblEHSLocationUUID").setVisible(true);
            this.getView().byId("inpEHSLocationUUID").setVisible(true);
            this.getView()
              .byId("lblIncidentLocationDescription")
              .setVisible(false);
            this.getView()
              .byId("inpIncidentLocationDescription")
              .setVisible(false);
              sap.ui.getCore().getModel("ReportIncidentView").setProperty("/LocationCompany", 0);
              // this.getModel().setProperty(sPath + "/VehicleCompanyOwned", true);
          } else {
            this.getView().byId("lblEHSLocationUUID").setVisible(false);
            this.getView().byId("inpEHSLocationUUID").setVisible(false);
            this.getView()
              .byId("lblIncidentLocationDescription")
              .setVisible(true);
            this.getView()
              .byId("inpIncidentLocationDescription")
              .setVisible(true);
            sap.ui.getCore().getModel("ReportIncidentView").setProperty("/LocationCompany", 1);
            // this.getModel().setProperty(sPath + "/VehicleCompanyOwned", false);
          }
        },

        onSelectVehicle: function (oEvent) {
          var bSelected = oEvent.getParameter("selected"),
          oModel = sap.ui.getCore().getModel("ReportIncidentView"),
          sPath = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getPath();
    
          if (bSelected) {
            this.getView().byId("idVehicleUnitNo").setVisible(false);
            this.getView().byId("idVehicleUnitNoValue").setVisible(false);
            this.getView().byId("idVehicleLicense").setRequired(true);
            this.getModel().setProperty(sPath + "/VehicleCompanyOwned", "X");
            oModel.setProperty(sPath + "/IsVehicleCompanyOwned", true);
          } else {
            this.getView().byId("idVehicleUnitNo").setVisible(true);
            this.getView().byId("idVehicleUnitNoValue").setVisible(true);
            this.getView().byId("idVehicleLicense").setRequired(false);
            this.getModel().setProperty(sPath + "/VehicleCompanyOwned", "");
            oModel.setProperty(sPath + "/IsVehicleCompanyOwned", false);
          }
    
        },
    	
        onPressSubmit: function (oEvent) {
          var sSempraVehUnitValue = this.getView().byId("idVehicleUnitNoValue").getValue(),
            sSempraVehLicenseValue = this.getView().byId("idVehicleLicenseValue").getValue(),
            isVehicleSelected = this.getView().byId("idVehicle").getSelected(),
            sMessage = "You must fill in Vehicle Unit No or Vehicle Lic.No before submitting",
            sTitle = "EHSM - Environment & Safety";
    
          if (!isVehicleSelected) {
            if (sSempraVehUnitValue === "" && sSempraVehLicenseValue === "") {
              MessageBox.show(sMessage, {
                title: sTitle
              });
            } else {
              this.submitIncident(oEvent);
            }
          } else {
            this.submitIncident(oEvent);
          }
    
        },

        // onReqMviValueHelp: function (oEvent) {
        //   // var aIncidents = this.getModel().getProperty("/Incidents");
        //   // var filter = aIncidents[aIncidents.length - 1].SftyObsGroup != '' ? aIncidents[aIncidents.length - 1].SftyObsGroup : aIncidents[
        //   // 	aIncidents.length - 1].NmGroup;

        //   var oInput = oEvent.getSource();
        //   var oDialog = this.byId("MviTypeValueSelectDialog");
        //   if (!oDialog) {
        //     oInput.setBusy(true);
        //     Fragment.load({
        //       id: this.getView().getId(),
        //       name: "Sempra.EHS.Incident.fragment.MviType",
        //       controller: this,
        //     })
        //       .then(
        //         function (oMviTypeDialog) {
        //           oDialog = oMviTypeDialog;
        //           return this._populateMviTypes();
        //         }.bind(this)
        //       )
        //       .then(
        //         function (response) {
        //           oInput.setBusy(false);
        //           this.getView().addDependent(oDialog);
        //           var aFilters = [
        //             new Filter("ReportIncident", "EQ", filters.get(filter)),
        //           ];
        //           this.byId("MviTypeValueSelectDialog")
        //             .getBinding("items")
        //             .filter(aFilters);

        //           oDialog.open();
        //         }.bind(this)
        //       )
        //       .catch(
        //         function (err) {
        //           console.log(err);
        //           oInput.setBusy(false);
        //         }.bind(this)
        //       );
        //   } else {
        //     oDialog.open();
        //   }
        // },

        // /**
        //  * This method is used to allow the user to search through the MVI type list.
        //  */
        // onSearchMviType: function (oEvent) {
        //   var aFilters = [
        //     new Filter("Code", "Contains", oEvent.getParameter("value")),
        //   ];
        //   this.byId("MviTypeValueSelectDialog")
        //     .getBinding("items")
        //     .filter(aFilters);
        // },

        // /**
        //  * This method is used to copy selected mvi types into the selected incident record.
        //  */
        // onConfirmMviType: function (oEvent) {
        //   var oSelectedItem = oEvent.getParameter("selectedItem");
        //   if (oSelectedItem) {
        //     var oMviType = oSelectedItem.getBindingContext().getObject();
        //     var sPath = this.getView()
        //       .getElementBinding()
        //       .getBoundContext()
        //       .getPath();
        //     this.getModel().setProperty(sPath + "/MviIncTypeCode", oMviType);
        //     this.byId("idSelectMviType").setValue(
        //       oMviType.MviType === "No Mvi Type" ? "" : oMviType.MviType
        //     );
        //   }
        // },

        onNameValueHelp: function (oEvent) {
          // var aIncidents = this.getModel().getProperty("/Incidents");
          // var filter = aIncidents[aIncidents.length - 1].SftyObsGroup != '' ? aIncidents[aIncidents.length - 1].SftyObsGroup : aIncidents[
          // 	aIncidents.length - 1].NmGroup;

          var oInput = oEvent.getSource();
          debugger;
          var oDialog = this.byId("NameValueSelectDialog");
          this._sInputId = oEvent.getSource().getId();
          // var sGrowingThreshold = 50; //sGrowingThreshold will be 100

          if (!oDialog) {
            oInput.setBusy(true);
            // if (sGrowingThreshold)
            // {
            //   oDialog.setGrowing(sGrowingThreshold);
            // }
            Fragment.load({
              id: this.getView().getId(),
              name: "Sempra.EHS.Incident.fragment.Name",
              controller: this,
            })
              .then(
                function (oNameDialog) {
                  oDialog = oNameDialog;
                  return this._populateNames();
                }.bind(this)
              )
              .then(
                function (response) {
                  oInput.setBusy(false);
                  this.getView().addDependent(oDialog);
                  // var aFilters = [
                  //   new Filter("CompanyID", "EQ", "2100")
                  // ];
                  // var aFilters = [
                  //   new Filter("ReportIncident", "EQ", filters.get(filter)),
                  // ];
                  // this.byId("NameValueSelectDialog")
                  //   .getBinding("items")
                  //   .filter(aFilters);

                  oDialog.open();
                }.bind(this)
              )
              .catch(
                function (err) {
                  oInput.setBusy(false);
                }.bind(this)
              );
          } else {
            oDialog.open();
          }
        },

        /**
         * This method is used to allow the user to search through the name list.
         */
        onSearchNames: function (oEvent) {
          var aFilters = [
            new Filter("Id", "Contains", oEvent.getParameter("value")),
          ];
          this.byId("NameValueSelectDialog")
            .getBinding("items")
            .filter(aFilters);
        },

        /**
         * This method is used to copy selected names into the selected incident record.
         */
        onConfirmName: function (oEvent) {
          debugger;
          var oSelectedItem = oEvent.getParameter("selectedItem");
          if (oSelectedItem) {
            var oName = oSelectedItem.getBindingContext().getObject();
            // var ilength = oEvent.getSource().getId().split("-").length - 1;
            // var oId = oEvent.getSource().getId().split("-");
            var sPath = this.getView()
              .getElementBinding()
              .getBoundContext()
              .getPath();

            if (this._sInputId.includes("idDriverName")) {
              // this.byId("idDriverName").setValue(
              //   oName.Id === "No Name" ? "" : oName.Id
              // );
              this.byId("idDriverNum").setValue(oName.Personid);
              this.byId("idDriverName").setValue(oName.Id);
              this.getModel().setProperty(sPath + "/VehDrivID", oName.IdInt);
              sap.ui.getCore().getModel("ReportIncidentView").setProperty("/DriverName", oName.Personid);
            } else if (this._sInputId.includes("idInjuredName")) {
              // this.byId("lblPersNumInj").setValue(
              //   oName.Id === "No Name" ? "" : oName.Id
              // );
              this.byId("idInjuredNum").setValue(oName.Personid);
              this.byId("idInjuredName").setValue(oName.Id);
              this.getModel().setProperty(sPath + "/InjPerID", oName.IdInt);
              sap.ui.getCore().getModel("ReportIncidentView").setProperty("/InjuredName", oName.Personid);
            } else if (this._sInputId.includes("idWitnessName")) {
              // this.byId("lblPersNumInj").setValue(
              //   oName.Id === "No Name" ? "" : oName.Id
              // );
              this.byId("idWitnessNum").setValue(oName.Personid);
              this.byId("idWitnessName").setValue(oName.Id);
              this.getModel().setProperty(sPath + "/WitnessID", oName.IdInt);
              sap.ui.getCore().getModel("ReportIncidentView").setProperty("/WitnessName", oName.Personid);
            }
          }
        },
        // onSelectTimeUnknown: function (oEvent) {
        // 	var bSelectedTimeUnknown = oEvent.getParameter("selected");
        // 	if (bSelectedTimeUnknown) {
        // 		this.getView().byId("idIncidentTime").setEnabled(false);
        // 	} else {
        // 		this.getView().byId("idIncidentTime").setEnabled(true);
        // 	}
        // },

        // onSelectVehComp: function (oEvent) {
        // 	var bSelectedVehComp = oEvent.getParameter("selected");
        // 	if (bSelectedVehComp) {
        // 		this.getView().byId("idVehicleUnitNo").setVisible(true);
        // 		this.getView().byId("idVehicleUnitNoValue").setVisible(true);
        // 	} else {
        // 		this.getView().byId("").setVisible(false);
        // 		this.getView().byId("idVehicleUnitNoValue").setVisible(false);
        // 	}

        // },

        // onSelectVehOwn: function (oEvent) {
        // 	var bSelectedVehOwn = oEvent.getParameter("selected");
        // 	if (bSelectedVehOwn) {
        // 		this.getView().byId("idVehicleLicenseValue").setVisible(true);
        // 		this.getView().byId("idVehicleLicense").setVisible(true);
        // 	} else {
        // 		this.getView().byId("idVehicleLicenseValue").setVisible(false);
        // 		this.getView().byId("lidVehicleLicense").setVisible(false);
        // 	}
        // },
        // ,

        // onPressCamera: function () {
        // 	var that = this;
        // 	var cameraDialog = new Dialog({
        // 		title: "Click on Capture to take a photo",
        // 		beginButton: new Button({
        // 			text: "Capture Photo",
        // 			press: function (oEvent) {
        // 				that.imageVal = document.getElementById("player");
        // 				var oButton = oEvent.getSource();
        // 				that.imageText = oButton.getParent().getContent()[1].getValue();
        // 				cameraDialog.close();
        // 				document.getElementById("player").remove();
        // 			}
        // 		}),
        // 		content: [
        // 			new sap.ui.core.HTML({
        // 				content: "<video id='player' autoplay></video>"
        // 			}),
        // 			new sap.m.Input({
        // 				placeholder: "Please enter the image name",
        // 				required: true
        // 			})
        // 		],
        // 		endButton: new Button({
        // 			text: "Cancel",
        // 			press: function () {
        // 				cameraDialog.close();
        // 				document.getElementById("player").remove();
        // 			}
        // 		})
        // 	});

        // 	this.getView().addDependent(cameraDialog);
        // 	cameraDialog.open();
        // 	cameraDialog.attachBeforeClose(this.setImage, this);
        // 	if (navigator.mediaDevices) {
        // 		navigator.mediaDevices.getUserMedia({
        // 			video: true
        // 		}).then(function (stream) {
        // 			player.srcObject = stream;
        // 		});
        // 	}
        // },

        // setImage: function () {
        // 	var oVBox = this.getView().byId("VBox1");
        // 	var oItems = oVBox.getItems();
        // 	var snapId = "Sempra-" + oItems.length;
        // 	var fileName = this.imageText;
        // 	var imageVal = this.imageVal;
        // 	if (imageVal === null) {
        // 		MessageToast.show("No image Captured");
        // 	} else {
        // 		var oCanvas = new sap.ui.core.HTML({
        // 			content: "<canvas id ='" + snapId + "'width='320px' height='320px'" +
        // 				"style = '2px solid red'></canvas>" + "<label id='" + fileName + "'>" + this.imageText + "</label>"

        // 		});

        // 		oVBox.addItem(oCanvas);
        // 		oCanvas.addEventDelegate({
        // 			onAfterRendering: function () {
        // 				var snapShotCanvas = document.getElementById(snapId);
        // 				var oContext = snapShotCanvas.getContext('2d');
        // 				oContext.drawImage(imageVal, 0, 0, snapShotCanvas.width, snapShotCanvas.height);

        // 				var imageData = snapShotCanvas.toDataURL('image/png');
        // 				var imageBase64 = imageData.substring(imageData.indexOf(",") + 1);
        // 				// window.open(imageData);
        // 				// var oImageData = imageData.toDataURL('image/png');
        // 				// return imageData;

        // 				// if (typeof imageData === "string") {
        // 				// 	debugger;
        // 				// 	var sTrimmed = imageData.substr(104);
        // 				// 	return "data:image/bmp;base64," + sTrimmed;
        // 				// }

        // 				// --Use this if you dont want to use third party download.js file
        // 				// Download(imageData, fileName + ".png", "image/png");
        // 				// var image = oImage.toDataURL("image/png").replace("image/png", "image/octet-stream"); // here is the most important part because if you dont replace you will get a DOM 18 exception.

        // 				// var canvas = document.getElementById("mycanvas");

        // 				// oContext.fillStyle = "green";
        // 				// oContext.fillRect(50, 50, 100, 100);

        // 				// var sURL = oContent.canvas.toDataURL("image/png");

        // 				// var image = snapShotCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        // 				// var image = canvas.toDataURL("image/png");
        // 				// document.write('<img src="'+ "img" +'"/>');

        // 			}
        // 		});

        // var canvas = document.getElementById('myCanvas');
        // var ctx = canvas.getContext('2d');
        // ctx.fillStyle = 'red';
        // ctx.fillRect(0, 0, 100, 100);
        // ctx.lineWidth = 10;
        // ctx.strokeRect(20, 20, 60, 60);

        // DownloadCanvasAsImage: function () {

        // }

        // }
        // },

        /**
         * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
         * @memberOf Sempra.EHS.Incident.view.ReportIncident
         */
        //	onExit: function() {
        //
        //	}

        // /**
        //  * This method is used to load name master data into context.
        //  */
        // _populateMviTypes: function () {
        //   if (!this._bMviTypesPopulated) {
        //     return new Promise(
        //       function (resolve, reject) {
        //         this.getModel("sap_ro").read("/MviIncTypeCodeSet", {
        //           success: function (oResponse) {
        //             this._bMviTypesPopulated = true;
        //             var aMviTypes = [
        //               {
        //                 MviType: "No MVi Type",
        //                 // ,
        //                 // LocationUUID: ""
        //               },
        //             ];
        //             aMviTypes = aMviTypes.concat(oResponse.results);

        //             var oModel = this.getModel().getProperty("/");
        //             oModel.MviTypes = aMviTypes;
        //             this.getOwnerComponent()
        //               .getModel()
        //               .setProperty("/", oModel);
        //             resolve();
        //           }.bind(this),

        //           error: function (err) {
        //             MessageBox.error("Failed to load Mvi Types");
        //             reject(err);
        //           },
        //         });
        //       }.bind(this)
        //     );
        //   } else {
        //     return Promise.resolve();
        //   }
        // },

        /**
         * This method is used to load name master data into context.
         */
        _populateNames: function () {
          var oFilter = new Filter("CompanyID", "EQ", "2100");

          if (!this._bNamesPopulated) {
            return new Promise(
              function (resolve, reject) {
                this.getModel("sap_ro").read("/SearchPersonSet", {
                  urlParameters: {
                    "$top": 1000,
                    "$skip": 0,
                },
                  filters: [oFilter],
                  success: function (oResponse) {
                    this._bNamesPopulated = true;
                    var aSearchPersonSets = [
                      {
                        Personid: "No name"
                      },
                    ];
                    aSearchPersonSets = aSearchPersonSets.concat(oResponse.results);

                    var oModel = this.getModel().getProperty("/");
                    oModel.SearchPersonSet = aSearchPersonSets;
                    this.getOwnerComponent()
                      .getModel()
                      .setProperty("/", oModel);
                    resolve();
                  }.bind(this),

                  error: function (err) {
                    MessageBox.error("Failed to load names");
                    reject(err);
                  },
                });
              }.bind(this)
            );
          } else {
            return Promise.resolve();
          }
        },
      }
    );
  }
);
