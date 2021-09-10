sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "Sempra/EHS/Incident/model/models",
    "Sempra/EHS/Incident/model/IDBUtils",
    "sap/ui/model/Filter"
  ],
  function (UIComponent, Device, MessageBox, JSONModel, models, IDBUtils, Filter) {
    "use strict";
    /* eslint-env es6 */

    return UIComponent.extend("Sempra.EHS.Incident.Component", {
      metadata: {
        manifest: "json",
      },

      IDBUtils: IDBUtils,

      attachmentWorker: null,

      /**
       * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
       * @public
       * @override
       */
      init: function () {
        // Call the base component's init function:
        UIComponent.prototype.init.apply(this, arguments);

        // Initialize the device model:
        this.setModel(models.createDeviceModel(), "device");

        // Initialize a Web Worker to process attachments:
        this.attachmentWorker = new Worker("./controller/AttachmentWorker.js");

        this.attachmentWorker.onmessage = function (e) {
          // Remove any attachments linked to successfully processed incidents in IDB:
          this.clearIncidentAttachments(e.data);
        }.bind(this);

        // Create the main incidents app model:
        this.setModel(
          new JSONModel({
            Incidents: [],
          })
        );

        // Initialize the IndexedDB data store:
        this.initializeIDB();

        // Wait for the OData services' metadata to load:
        Promise.all([
          this.getModel("sap_ro").metadataLoaded(),
          this.getModel("sap_rw").metadataLoaded(),
          this.getModel("flp").metadataLoaded(),
          this.getModel("ehs_utils").metadataLoaded(),
        ])
          .then((result) => {
            // Define a custom part handler to deal with SAP's screwy OData service:
            this.defineCustomPartHandler();

            // Add an event listener to intercept failed service requests:
            var aModelKeys = ["sap_ro", "sap_rw", "flp", "ehs_utils"];
            aModelKeys.forEach(
              function (sModelKey) {
                // Attach an event handler to the requestFailed event for each of the models:
                this.getModel(sModelKey).attachRequestFailed(
                  function (oEvent) {
                    // Look for authorization errors:
                    var oParams = oEvent.getParameters();
                    if (
                      oParams.response.statusCode === 401 ||
                      oParams.response.statusCode === 403
                    ) {
                      // Try to refresh the CSRF security token:
                      this.getModel(sModelKey).refreshSecurityToken(
                        function () {
                          MessageBox.confirm(
                            "An unexpected error occurred while trying to connect to SAP - please try again",
                            {
                              title: "SAP Connection Error",
                              details:
                                "<p><strong>This can happen if:</strong></p>\n" +
                                "<ul>" +
                                "<li>You are not connected to the network</li>" +
                                "<li>The authentication service is not available</li>" +
                                "<li>An underlying system is down</li>" +
                                "</ul>",
                              styleClass:
                                "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
                              onClose: function (sAction) {
                                if (sAction === MessageBox.Action.OK) {
                                }
                              },
                            }
                          );
                        },

                        function (oError) {
                          console.log(
                            "Could not refresh CSRF security token for " +
                              sModelKey
                          );
                          console.log(oError);
                        }
                      );
                    }
                  }.bind(this)
                );
              }.bind(this)
            );

            // Cache key master data elements for the application:
            Promise.all([
              this.preloadLocations(),
              this.preloadLocationClassifications(),
              this.preloadCurrentUser(),
              this.preloadCatalog(),
              this.preloadPersonsName(),
              // ReportIncident
              this.preloadMviType(),
              //   this.preloadPersons(),
            ])
              .then((response) => {
                // Create a global application model:
                this.createAppModel(response);

                // Fire up the app router:
                this.getRouter().initialize();
              })
              .catch((oError) => {
                console.log("Failed to cache master data elements");
                console.log(oError);
              });
          })
          .catch((error) => {
            console.log(
              "An unexpected error occurred while trying to load the OData service metadata"
            );
            console.log(error);
          });
      },

      /**
       * This method is used to fetch the attachment worker for the component
       */
      getAttachmentWorker: function () {
        return this.attachmentWorker;
      },

      /**
       * This method is used to create the global app model used throughout the application.
       */
      createAppModel: function (aResponses) {
        // Local Data Declarations:
        var sCurrentUser = "";

        // Check to see if we were able to determine the current user.
        if (aResponses && aResponses.length >= 3) {
          sCurrentUser = aResponses[2].UserName;
        }

        // Create a global application model:
        var oApp = {
          FLPShell:
            sap.ushell != undefined && sap.ushell.Container != undefined,
          ReadOnly: false,
          CurrentUser: sCurrentUser,
          Tiles: [
            {
              TileName: "Report Near Miss",
              MatchKeywords: ["Report Near Miss"],
              Target: "NearMiss",
              Visible: true,
              Icon: "sap-icon://Fiori2/F0316",
            },
            {
              TileName: "Report Stop the Job",
              MatchKeywords: ["Report Stop the Job"],
              Target: "StopTheJob",
              Visible: false,
              Icon: "sap-icon://Fiori2/F0316",
            },
            {
              TileName: "Submit Safety Suggestion",
              MatchKeywords: ["Submit Safety Suggestion"],
              Target: "SafetySuggestions",
              Visible: false,
              Icon: "sap-icon://Fiori2/F0316",
            },
            {
              TileName: "Submit Hazard Identification",
              MatchKeywords: ["Submit Hazard Identification"],
              Target: "HazardIdentification",
              Visible: false,
              Icon: "sap-icon://Fiori2/F0316",
            },
            {
              TileName: "Report Incident",
              MatchKeywords: ["Report Incident"],
              Target: "ReportIncident",
              Visible: true,
              Icon: "sap-icon://Fiori2/F0316",
            },
          ],
        };

        // Check to see if we were able to determine which tiles the user has access to:
        if (aResponses && aResponses.length >= 4) {
          if (
            aResponses[3] &&
            aResponses[3].results &&
            aResponses[3].results.length > 0
          ) {
            aResponses[3].results.forEach(function (oCatalogResult) {
              if (
                !oCatalogResult.Chips ||
                !oCatalogResult.Chips.results ||
                oCatalogResult.Chips.results.length === 0
              ) {
                return;
              }

              oCatalogResult.Chips.results.forEach(function (oChip) {
                if (oChip.title) {
                  oApp.Tiles.forEach(function (oTile) {
                    if (oTile.TileName === oChip.title) {
                      oTile.Visible = true;
                      return;
                    }
                  });
                }
              });
            });
          }
        }

        var oAppModel = new JSONModel(oApp);
        this.setModel(oAppModel, "app");
      },

      /**
       * This method is used to define a custom part handler for the OData model used to post incidents.
       */
      defineCustomPartHandler: function () {
        var oOData = window.OData;

        oOData.batchHandler.partHandler = {
          read: oOData.defaultHandler.read,
          write: function (request, context) {
            if (request.headers["Content-Encoding"] === "base64") {
              request.body = request.data;
              return true;
            } else {
              return oOData.defaultHandler.write(request, context);
            }
          },
        };
      },

      /**
       * This method is used to initialize the IDB database we'll be using within the app.
       */
      initializeIDB: function () {
        var db = window.indexedDB.open("IncidentDB", 1);

        db.onupgradeneeded = function (event) {
          var tmpDb = event.target.result;
          var incidentstore = tmpDb.createObjectStore("incidentstore", {
            autoIncrement: true,
          });
          var attachmentstore = tmpDb.createObjectStore("attachmentstore", {
            autoIncrement: true,
          });
          var locationstore = tmpDb.createObjectStore("Locations", {
            autoIncrement: true,
            keyPath: "LocationUUID",
          });
          var locationclassificationstore = tmpDb.createObjectStore(
            "LocationClassifications",
            { autoIncrement: true, keyPath: "Code" }
          );
          var usernameStore = tmpDb.createObjectStore("GetCurrentUser", {
            autoIncrement: true,
            keyPath: "UserName",
          });
          var chipStore = tmpDb.createObjectStore("Catalog", {
            autoIncrement: true,
            keyPath: "id",
          });

          //Report Incident
          var MviTypeStore = tmpDb.createObjectStore("MviIncTypeCodeSet", {
            autoIncrement: true,
            keyPath: "Code",
          });
          var PersonsStore = tmpDb.createObjectStore("Name", {
            autoIncrement: true,
            keyPath: "Name",
          });

          //Configure the Person:
          var PersonsName = tmpDb.createObjectStore("SearchPersonSet", {
            autoIncrement: true,
            keyPath: "Personid",
          });

          //Configure the MviType store used to store Mvi Type master data for the app:
          MviTypeStore.createIndex("Code", "Code");
          MviTypeStore.createIndex("DescriptionLong", "DescriptionLong");
          PersonsStore.createIndex("Name", "Name");

          // Configure the location store used to store location master data for the app:
          locationstore.createIndex("LocationLatitude", "LocationLatitude");
          locationstore.createIndex("LocationLongitude", "LocationLongitude");
          locationstore.createIndex("LocationName", "LocationName");
          locationstore.createIndex("LocationType", "LocationType");
          locationstore.createIndex("LocationUUID", "LocationUUID");
          locationstore.createIndex("SftyObsGroup", "SftyObsGroup");

          PersonsName.createIndex("Personid", "Personid");
          PersonsName.createIndex("Id", "Id");

          // Configure the location classificiation store used to store location master data for the app:
          locationclassificationstore.createIndex("Code", "Code");
          locationclassificationstore.createIndex("Description", "Description");

          // Configure the incident store used to store incident draft records:
          incidentstore.createIndex("NmGroup", "NmGroup");
          incidentstore.createIndex("UUID", "UUID");

          // Configure the attachment store used to store incident attachments:
          attachmentstore.createIndex("content", "content");
          attachmentstore.createIndex("UUID", "UUID");
          attachmentstore.createIndex("ParentUUID", "ParentUUID");

          // Configure a table used to store details about the current user:
          usernameStore.createIndex("UserName", "UserName");

          // configure a table for tiles
          chipStore.createIndex("id", "id");
        };
      },

      // Report Incident
      // /**
      //  * This method is used to pre-fetch Mvi Type master records into context.
      //  */
       preloadMviType: function() {
      	return new Promise((resolve, reject) => {
      		// Check to see if we've already pre-loaded the Mvi Type:
      		return this.IDBUtils.hasRecords("MviIncTypeCodeSet")
      		.then((bResult) => {
      			if (!bResult) {
      				// If not, go ahead and try to fetch them from SAP EHSM:
      				this.getModel("sap_ro").read("/MviIncTypeCodeSet", {
      					success: function(data) {
      						resolve(this.IDBUtils.saveToIDB("MviIncTypeCodeSet", data.results));
      					}.bind(this),
      					error: function(err) {
      						reject(err);
      					}
      				});
      			}
      			else {
      				resolve();
      			}
      		})
      		.catch((e) => {
      			reject(e);
      		});
      	});
      },

      // /**
      //  * This method is used to pre-fetch Persons master records into context.
      //  */
      // preloadPersons: function() {
      // 	return new Promise((resolve, reject) => {
      // 		// Check to see if we've already pre-loaded the locations:
      // 		return this.IDBUtils.hasRecords("SearchPersonSet")
      // 		.then((bResult) => {
      // 			if (!bResult) {
      // 				// If not, go ahead and try to fetch them from SAP EHSM:
      // 				this.getModel("sap_ro").read("/SearchPersonSet", {
      // 					success: function(data) {
      // 						resolve(this.IDBUtils.saveToIDB("Persons", data.results));
      // 					}.bind(this),
      // 					error: function(err) {
      // 						reject(err);
      // 					}
      // 				});
      // 			}
      // 			else {
      // 				resolve();
      // 			}
      // 		})
      // 		.catch((e) => {
      // 			reject(e);
      // 		});
      // 	});
      // },
    
	  
		preloadLocations: function() {
			return new Promise((resolve, reject) => {
				// Check to see if we've already pre-loaded the locations:
				return this.IDBUtils.hasRecords("Locations")
				.then((bResult) => {
					if (!bResult) {
						// If not, go ahead and try to fetch them from SAP EHSM:
						this.getModel("sap_ro").read("/Locations", {
							success: function(data) {
								resolve(this.IDBUtils.saveToIDB("Locations", data.results));
							}.bind(this),
							error: function(err) {
								reject(err);
							}
						});
					}
					else {
						resolve();
					}
				})
				.catch((e) => {
					reject(e);
				});
			});
		},
		
		preloadPersonsName: function() {
      var oFilter = new Filter("CompanyID", "EQ", "2100");

			return new Promise((resolve, reject) => {
				// Check to see if we've already pre-loaded the locations:
				return this.IDBUtils.hasRecords("SearchPersonSet")
				.then((bResult) => {
					if (!bResult) {
						// If not, go ahead and try to fetch them from SAP EHSM:
						this.getModel("sap_ro").read("/SearchPersonSet", {
              filters: [oFilter],
              urlParameters: {
                "$top": 1000,
                "$skip": 0
            },
							success: function(data) {
								resolve(this.IDBUtils.saveToIDB("SearchPersonSet", data.results));
							}.bind(this),
							error: function(err) {
								reject(err);
							}
						});
					}
					else {
						resolve();
					}
				})
				.catch((e) => {
					reject(e);
				});
			});
		},

      /**
       * This method is used to pre-load location classification records into context.
       */
      preloadLocationClassifications: function () {
        return new Promise((resolve, reject) => {
          // Check to see if we've alrady pre-loaded the location classification data:
          return this.IDBUtils.hasRecords("LocationClassifications")
            .then((bResult) => {
              if (!bResult) {
                // If not, go ahead and try to fetch them from SAP EHSM:
                this.getModel("sap_ro").read("/LocationClassifications", {
                  urlParameters: {
                    $skip: 0,
                    $top: 100,
                    $inlinecount: "allpages",
                  },
                  success: function (data) {
                    resolve(
                      this.IDBUtils.saveToIDB(
                        "LocationClassifications",
                        data.results
                      )
                    );
                  }.bind(this),
                  error: function (err) {
                    reject(err);
                  },
                });
              } else {
                resolve();
              }
            })
            .catch((e) => {
              reject(e);
            });
        });
      },

      /**
       * This method is used to pre-load details about the current user into context.
       */
      preloadCurrentUser: function () {
        return new Promise((resolve, reject) => {
          return this.IDBUtils.getCurrentUser().then((oUser) => {
            if (oUser) {
              resolve(oUser);
            } else {
              this.getModel("ehs_utils").callFunction("/GetCurrentUser", {
                success: function (oData, response) {
                  var oCurrentUser = oData.GetCurrentUser;
                  oCurrentUser.AccessTime = new Date();
                  this.IDBUtils.saveToIDB("GetCurrentUser", oCurrentUser)
                    .then(() => {
                      resolve(oData.GetCurrentUser);
                    })
                    .catch(() => {
                      resolve(oData.GetCurrentUser);
                    });
                }.bind(this),
                error: function (oError) {
                  reject(oError);
                }.bind(this),
              });
            }
          });
        });
      },

      /**
       * This method is used to pre-load metadata about the user's tile assignments into context.
       */
      preloadCatalog: function () {
        return new Promise((resolve, reject) => {
          // Check to see if we've already pre-loaded the tile catalog:
          return this.IDBUtils.getAllRecordsFromTable("Catalog")
            .then((response) => {
              if (response.length > 0) {
                // If so, then just pass the results back from the IDB cache:
                resolve({ results: response });
                return;
              } else {
                // Otherwise, try to fetch the catalog data from the OData service:
                this.getModel("flp").read("/Catalogs", {
                  urlParameters: {
                    $expand: "Chips",
                  },

                  success: function (data) {
                    // Cache the data in IDB:
                    if (data.results.length > 0) {
                      this.IDBUtils.saveToIDB("Catalog", data.results).then(
                        () => {
                          resolve(data);
                          return;
                        }
                      );
                    }
                  }.bind(this),

                  error: function (err) {
                    reject(err);
                  }.bind(this),
                });
              }
            })
            .catch((e) => {
              reject(e);
            });
        });
      },

      /**
       * This method is used to remove attachments from successfully submitted incidents.
       */
      clearIncidentAttachments: function (oIncident) {
        // Lookup the internal UUID for the incident:
        return this.IDBUtils.getIncidentByEHSId(oIncident.IncidentUUID).then(
          function (oIncidentDB) {
            // Fetch all of the attachments linked to the incident:
            return this.IDBUtils.getAllAttachmentsByIncidentFromIDB(
              "attachmentstore",
              oIncidentDB.UUID
            ).then(
              function (aAttachments) {
                // Remove each attachment one-by-one:
                return Promise.all(
                  aAttachments.map(
                    function (attachment) {
                      return this.IDBUtils.deleteIDBRecord(
                        "attachmentstore",
                        attachment.UUID
                      );
                    }.bind(this)
                  )
                );
              }.bind(this)
            );
          }.bind(this)
        );
      },
    });
  }
);
