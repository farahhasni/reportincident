sap.ui.define(
  [
    "Sempra/EHS/Incident/controller/BaseController",
    "Sempra/EHS/Incident/model/IDBUtils",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/m/MessageBox",
    "sap/base/Log",
    "Sempra/EHS/Incident/controller/Formatter",
    "Sempra/EHS/Incident/model/Incident",
  ],
  function (
    BaseController,
    IDBUtils,
    Fragment,
    Filter,
    MessageBox,
    Log,
    Formatter,
    Incident
  ) {
    "use strict";

    return BaseController.extend(
      "Sempra.EHS.Incident.controller.IncidentBaseController",
      {
        formatter: Formatter,

        // Inject an instance of our IDB utilities class:
        IDBUtils: IDBUtils,

        // Define a map of incident statuses used within the application:
        IncidentStatus: {
          Draft: "",
          Pending: "98",
          Void: "00",
          New: "01",
          InProgress: "02",
          Closed: "03",
          Reopened: "04",
          Error: "99",
        },

        // Define a map of incident sub-categories used within the application:
        IncidentSubCategories: new Map([
          ["NearMiss", "ZEHHSS_NMG_NM_CC"],
          ["StopTheJob", "ZEHHSS_NMG_STOP_WORK"],
          ["SafetySuggestions", "ZEHHSS_SOG_SFTY_SUG"],
          ["HazardIndentification", "ZEHHSS_SOG_HAZARD_ID"],
          //Report Incident
          ["ReportIncident", "EHHSS_IGR_OCC_INC"],
          ["ReportIncident", "ZEHHSS_IGR_MVI"],
        ]),

        CACHE_TIME_TO_LIVE: 60 * 60 * 24 * 7 * 1000, // 7 Days

        appTitle: "EHSM - Environment & Safety",

        /**
         * This method is used to create a new incident object (in-memory representation only).
         */
        createNewIncident: function (incidentCategory) {
          // Reset the attachment title as we are on a new incident:
          this.byId("attachmentsTitle").setText("Attachments (0)");

          return new Incident(incidentCategory);
        },

        /**
         * This method is used to add an incident record to the in-memory JSON model used by the app.
         */
        addIncidentToModel: function (oIncident) {
          oIncident.Attachments = [];
          oIncident.MessageLog = [];

          var oModel = this.getModel();
          var aIncidents = oModel.getProperty("/Incidents");

          aIncidents.push(oIncident);

          oModel.setProperty("/Incidents", aIncidents);

          return aIncidents.length - 1;
        },

        /**
         * This method is used to remove an incident from the in-memory JSON model used by the app.
         */
        removeIncidentFromModel: function (oIncident) {
          var oModel = this.getModel();
          var aIncidents = oModel.getProperty("/Incidents");

          for (var i = 0; i < aIncidents.length; i++) {
            if (aIncidents[i].UUID === oIncident.UUID) {
              aIncidents.splice(i, 1);
              break;
            }
          }

          oModel.setProperty("/Incidents", aIncidents);
        },

        /**
         * This method is used to add a message to an incident's message log:
         */
        addToIncidentMessageLog: function (incidentUUID, message) {
          var oModel = this.getModel();
          var aIncidents = oModel.getProperty("/Incidents");

          for (var i = 0; i < aIncidents.length; i++) {
            if (aIncidents[i].UUID === incidentUUID) {
              // Update the JSON model first:
              aIncidents[i].MessageLog.push(message);
              oModel.setProperty(
                "/Incidents/" + i + "/MessageLog",
                aIncidents[i].MessageLog
              );

              // Then, update the cached incident record in IDB:
              this.IDBUtils.updateIDBRecord(
                "incidentstore",
                aIncidents[i],
                incidentUUID
              );

              break;
            }
          }
        },

        /**
         * This method is triggered whenever a user presses the "Cancel" button on one of the incident creation pages.
         * This event handler will remove the in-flight draft record from memory and take the user back to the app landing page.
         */
        onCancelIncidentDraft: function (oEvent) {
          // Fetch the current draft incident into context:
          var oIncident = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getObject();

          // Remove any draft attachments that the user might have created up to now for the incident:
          oIncident.Attachments.forEach(function (oAttachment) {
            return this.IDBUtils.getRecordFromIDB("attachmentstore", {
              UUID: oAttachment.UUID,
              ParentUUID: oIncident.UUID,
            }).then(
              function (response) {
                return this.IDBUtils.deleteIDBRecord(
                  "attachmentstore",
                  response.key
                );
              }.bind(this)
            );
          }, this);

          // Remove the selected incident from the JSON model:
          this.removeIncidentFromModel(oIncident);

          // Take the user back to the landing page:
          this.navigateHome();
        },

        /**
         * This method is triggered whenever the user hits the "Submit" button to create an incident record.
         */
        submitIncident: function (oEvent) {
          // Fire up the busy dialog to show the user that we're working on submitting the incident:
          var oDialog = this.byId("BusyDialog");
          oDialog.open();

          // Fetch the selected incident record into context:
          var oIncident = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getObject();

          // Make sure that the user has entered all the required fields before submission:
          var aMessages = this.checkRequiredFields(oIncident);
          var message = "";

          if (aMessages && aMessages.length > 0) {
            message =
              "You must fill in all required fields before submitting:\n";
            aMessages.forEach(function (msg) {
              message = message + "\n" + msg;
            });

            MessageBox.show(message, {
              title: this.appTitle,
            });

            oDialog.close();
            return;
          }

          // Set the title if there isn't one (safety sugg && hazard ident.)
          if (oIncident.IncidentTitle === "") {
            oIncident.IncidentTitle =
              oIncident.IncidentDescriptionOfEvents.substring(0, 80);
          }

          // Fetch the reporting person for the submission:
          this.getReportingPerson(oIncident)
            .then(
              function (oIncidentNew) {
                // Once we have the person, store the record in IDB to ensure that we don't lose it in cases where the user is offline:
                return this.IDBUtils.updateIDBRecord(
                  "incidentstore",
                  oIncidentNew,
                  oIncidentNew.UUID
                )
                  .then(
                    function () {
                      // Then, try to send the incident record on to SAP EHSM:
                      return this.saveIncident(oIncidentNew)
                        .then(
                          function (oIncidentResults) {
                            // Disable the busy wait dialog:
                            oDialog.close();

                            // Check the results of the save request:
                            if (!oIncidentResults.HasErrors) {
                              // If there aren't any errors, then our job is done here:
                              if (this.getView().getViewName() === "Sempra.EHS.Incident.view.ReportIncident"){
                                this.getView().getModel().refresh();
                              }
                              MessageBox.success(
                                "Event #" +
                                  this.getFormattedIncidentNo(
                                    oIncidentResults.IncidentID
                                  ) +
                                  " was created in SAP",
                                {
                                  onClose: function (sAction) {
                                    // Take the user to the worklist if they have additional events queued up:
                                    if (window.navigator.onLine) {
                                      // Check to see if the user has unsubmitted incidents:
                                      this.IDBUtils.hasUnsubmittedIncident().then(
                                        (bResult) => {
                                          if (bResult) {
                                            // If so, give them the option to go sync up:
                                            MessageBox.confirm(
                                              "You have event records that haven't been sent to SAP - would you like to sync them now?",
                                              {
                                                title: this.appTitle,
                                                onClose: function (oAction) {
                                                  if (
                                                    oAction ===
                                                    MessageBox.Action.OK
                                                  ) {
                                                    // Take the user over to the worklist to trigger a sync-up:
                                                    this.getRouter().navTo(
                                                      "Worklist"
                                                    );
                                                  } else {
                                                    this.navigateHome();
                                                  }
                                                }.bind(this),
                                              }
                                            );
                                          } else {
                                            // Otherwise, take them to the home page:
                                            this.navigateHome();
                                          }
                                        }
                                      );
                                    } else {
                                      // Otherwise, take them to the home page:
                                      this.navigateHome();
                                    }
                                  }.bind(this),
                                }
                              );
                            } else {
                              // Otherwise, alert the user to the issues and take them over to the worklist:
                              message =
                                "An unexpected error occurred while trying to save the event:\n";
                              oIncidentResults.MessageLog.forEach(function (
                                msg
                              ) {
                                message = message + "\n" + msg;
                              });

                              MessageBox.show(message, {
                                title: this.appTitle,

                                onClose: function (sAction) {
                                  this.getRouter().navTo("Worklist", {}, true);
                                }.bind(this),
                              });
                            }
                          }.bind(this)
                        )
                        .catch(
                          function (oError) {
                            if (oError) {
                              var msg = "";
                              if (oError.statusCode === 0) {
                                msg =
                                  "Your record was unable to be saved to SAP. Please resync from the Worklist when you regain internet connection.";
                              } else if (oError.responseText) {
                                var oRespMsg = JSON.parse(oError.responseText);
                                if (
                                  oRespMsg &&
                                  oRespMsg.error &&
                                  oRespMsg.error.message &&
                                  oRespMsg.error.message.value
                                ) {
                                  msg = oRespMsg.error.message.value;
                                } else {
                                  msg = "An unexpected error occurred";
                                }
                              } else {
                                msg = "An unexpected error occurred";
                              }

                              oDialog.close();
                              MessageBox.error(msg, {
                                onClose: function (sAction) {
                                  this.navigateHome();
                                }.bind(this),
                              });

                              return;
                            }

                            oDialog.close();
                          }.bind(this)
                        );
                    }.bind(this)
                  )
                  .catch(
                    function (err) {
                      oDialog.close();
                    }.bind(this)
                  );
              }.bind(this)
            )
            .then(function () {}.bind(this))
            .catch(
              function (repPerErr) {
                oDialog.close();
              }.bind(this)
            );
        },

        /**
         * This method is responsible for saving an incident - first to IDB and then to SAP EHSM.
         */
        saveIncident: function (oIncident, uniqueContentId = 1) {
          // Local Data Declarations:
          var sGroupId = "createIncident";
          var msg = "";
          var oIncidentResults = {};

          return new Promise(
            function (resolve, reject) {
              // Prep the incident for posting to the SAP backend:
              var oIncidentNew = Object.assign({}, oIncident);

              delete oIncidentNew.UUID;
              delete oIncidentNew.idbPrimaryKey;
              oIncidentNew.IncidentID = "99999999999999999999";
              oIncidentNew.IncidentCreationUTCDateTime = new Date();
              delete oIncidentNew.Attachments;
              delete oIncidentNew.MessageLog;

              // Once the record is cached, go ahead and try to forward it on to SAP:
              return this.postIncident(
                oIncidentNew,
                uniqueContentId,
                sGroupId,
                oIncident.Attachments
              )
                .then((oResponse) => {
                  // Parse the complex response we get back from the OData batch request:
                  oIncidentResults = oResponse; //this.parseBatchResponse(oIncident, oResponse);

                  oIncident.IncidentUUID = oIncidentResults.IncidentUUID;
                  oIncident.IncidentID = oIncidentResults.IncidentID;
                  oIncident.IncidentStatus = oIncidentResults.IncidentStatus;
                  oIncident.MessageLog = oIncidentResults.MessageLog;

                  // Update the cached incident record in IDB with the results:
                  return this.IDBUtils.updateIDBRecord(
                    "incidentstore",
                    oIncident,
                    oIncident.UUID
                  )
                    .then(
                      function () {
                        resolve(oIncidentResults);
                      }.bind(this)
                    )
                    .catch(
                      function (err) {
                        reject(err);
                      }.bind(this)
                    );
                })
                .catch(
                  function (oError) {
                    // Update the IDB log to reflect the fact that the record was not synced to SAP:
                    oIncident.IncidentStatus = "";

                    if (navigator.onLine) {
                      oIncident.MessageLog = [oError.toString()];
                    } else {
                      oIncident.MessageLog = ["Event created while offline"];
                    }

                    var oIncidentResponse = {
                      HasErrors: true,
                      IncidentUUID: oIncident.IncidentUUID,
                      IncidentID: "",
                      IncidentStatus: oIncident.IncidentStatus,
                      MessageLog: oIncident.MessageLog,
                    };

                    this.IDBUtils.updateIDBRecord(
                      "incidentstore",
                      oIncident,
                      oIncident.UUID
                    )
                      .then(() => {
                        resolve(oIncidentResponse);
                      })
                      .catch((e) => {
                        reject(oError);
                      });
                  }.bind(this)
                );
            }.bind(this)
          );
        },

        /**
         * This method builds and processes the complex OData batch request required to post an incident record to SAP EHSM.
         */
        postIncident: function (
          oIncident,
          uniqueContentId,
          sGroupId,
          aAttachments
        ) {
          // First, post the incident:
          return new Promise((resolve, reject) => {
            // Set up the OData model for batch processing:
            this.getModel("sap_rw").setDeferredGroups([sGroupId, "changes"]);
            this.getModel("sap_rw").setHeaders({
              "X-Requested-With": "XMLHttpRequest",
            });

            // Create the incident header first:
            this.getModel("sap_rw").create("/Incidents", oIncident, {
              headers: {
                "Content-ID": uniqueContentId,
              },
              groupId: sGroupId,
              success: function (response) {
                // Nothing required here...
              },
              error: function (error) {
                reject(error);
              },
            });

            // Send the incident to EHSM using an OData batch request:
            this.getModel("sap_rw").submitChanges({
              groupId: sGroupId,

              success: function (oResponse, oBatchResponse) {
                // Parse the results of the incident response:
                var oIncidentResults = this.parseBatchResponse(
                  oIncident,
                  oResponse
                );
                if (oIncidentResults.HasErrors) {
                  resolve(oIncidentResults);
                } else {
                  // Upload the attachments that correspond with the selected incident - as necessary:
                  if (window.Worker) {
                    if (aAttachments.length > 0) {
                      // Use a Web Worker to upload the attachments asynchronously:
                      var aBase64Attach = aAttachments.map(function (
                        attachment
                      ) {
                        return {
                          UUID: attachment.UUID,
                          Filename: attachment.Filename,
                          ContentType: attachment.ContentType,
                          Content: this.arrayBufferToBase64(attachment.content),
                        };
                      },
                      this);

                      this.getOwnerComponent()
                        .getAttachmentWorker()
                        .postMessage({
                          IncidentUUID: oIncidentResults.IncidentUUID,
                          Attachments: aBase64Attach,
                          CSRFToken: this.getModel("sap_rw").getSecurityToken(),
                        });

                      resolve(oIncidentResults);
                    } else {
                      // Mark the incident as completely processed:
                      return this.setUploadCompleted(oIncidentResults)
                        .then(function () {
                          resolve(oIncidentResults);
                        })
                        .catch((e) => {
                          console.log(e);
                        });
                    }
                  } else {
                    // Trigger the upload synchronously as per usual:
                    this.setUseCustomHttpRequest(true);

                    // Upload the attachments one-by-one:
                    return Promise.all(
                      aAttachments.map(
                        function (attachment) {
                          this.uploadAttachment(oIncidentResults, attachment);
                        }.bind(this)
                      )
                    ).then(
                      function (attachmentResponses) {
                        // Call a function import to let SAP EHSM that the upload process is completed:
                        this.setUseCustomHttpRequest(false);
                        return this.setUploadCompleted(oIncidentResults).then(
                          function () {
                            resolve(oIncidentResults);
                          }.catch((e) => {
                            console.log(e);
                          })
                        );
                      }.bind(this)
                    );
                  }
                }
              }.bind(this),

              error: function (oError) {
                reject(oError);
              }.bind(this),
            });
          });
        },

        /**
         * This method is used to upload an attachment to the SAP EHSM backend.
         */
        uploadAttachment: function (incident, attachment) {
          return new Promise(
            function (resolve, reject) {
              // Initialize the upload process:
              this.getModel("sap_ro").setHeaders({
                "X-Requested-With": "XMLHttpRequest",
              });

              // Convert the attachment payload to Base 64:
              var content = this.arrayBufferToBase64(attachment.content);

              // Trigger the upload request:
              this.getModel("sap_ro").create("/MobileAttachmentSet", content, {
                headers: {
                  slug: incident.IncidentUUID + "," + attachment.Filename,
                  "Content-Encoding": "base64",
                  "Content-Type": attachment.ContentType,
                },

                success: function (oData, response) {
                  resolve(incident);
                }.bind(this),

                error: function (oError) {
                  reject(oError);
                }.bind(this),
              });
            }.bind(this)
          );
        },

        /**
         * This method is used to call an OData function import to let SAP EHSM know that attachments have been uploaded
         * successfully.
         */
        setUploadCompleted: function (incident) {
          // Call SetUploadComplete with IncidentKey to let SAP know the incident + all contents has been uploaded:
          return new Promise(
            function (resolve, reject) {
              this.getModel("sap_ro").callFunction("/SetUploadComplete", {
                method: "POST",
                urlParameters: {
                  IncidentKey: incident.IncidentUUID,
                },
                headers: {
                  "X-Requested-With": "XMLHttpRequest",
                },
                success: function (oResponse) {
                  // Update the cached incident record in IDB with the results:
                  resolve(incident);
                }.bind(this),
                error: function (oError) {
                  reject(oError);
                },
              });
            }.bind(this)
          );
        },

        /**
         * This method is used to trigger a mass upload of any other outstanding incident records that might be hanging around in the queue.
         */
        postOutstandingIncidents: function () {
          // Lookup the incidents cached in IDB:
          return this.IDBUtils.getAllIncidentsFromIDB("incidentstore").then(
            function (incidents) {
              // Filter out incidents that have already been processed:
              var aIncidents = incidents.filter(
                function (incident) {
                  return (
                    incident.IncidentStatus === this.IncidentStatus.Draft ||
                    incident.IncidentStatus === this.IncidentStatus.Pending
                  );
                }.bind(this)
              );
              if (aIncidents.length < 1) {
                return;
              }

              // First get all attachments from IDB:
              return this.IDBUtils.getAllIncidentsFromIDB("attachmentstore")
                .then(function (attachments) {
                  // Next, we need to loop over aIncidents and match up respective attachments:
                  var mappedIncidents = aIncidents.map(function (incident) {
                    incident.Attachments = attachments.filter(function (
                      attachment
                    ) {
                      return attachment.ParentUUID === incident.UUID;
                    });

                    return incident;
                  });

                  return mappedIncidents;
                })
                .then(
                  function (mappedIncidents) {
                    // Now, we need to post these incidents with promise.all
                    // what should we do once this is done?
                    return Promise.all(
                      mappedIncidents.map(
                        function (incident, i) {
                          return this.saveIncident(incident);
                        }.bind(this)
                      )
                    );
                  }.bind(this)
                )
                .catch(function (err) {
                  // what should do if it fails for some reason?
                  // messagebox.error to show user the error message
                  Log.error(err);
                  // MessageBox.error("Some records were unable to be saved to SAP. Please try again.");
                  // oDialog.close();
                });
            }.bind(this)
          );
        },

        /**
         * This method is used to parse the complex batch response we get back from the OData service call.
         */
        parseBatchResponse: function (oIncident, oResponse) {
          // Initialize the response object:
          var oIncidentResponse = {
            HasErrors: true,
            IncidentUUID: oIncident.IncidentUUID,
            IncidentID: "",
            IncidentStatus: oIncident.IncidentStatus,
            MessageLog: [],
          };

          // Sanity check - make sure we actually have something to parse:
          if (
            !oResponse.__batchResponses ||
            oResponse.__batchResponses.length === 0
          ) {
            oIncidentResponse.MessageLog.push(
              "An unexpected error occurred while trying to connect to SAP"
            );
            return oIncidentResponse;
          }

          // Look through the batch responses to see if the incident was successfully posted to SAP:
          for (var i = 0; i < oResponse.__batchResponses.length; i++) {
            var oBatchResponse = oResponse.__batchResponses[i];

            // Check to see if the response failed:
            var statusCode = 200;
            if (oBatchResponse.response && oBatchResponse.response.statusCode) {
              statusCode = parseInt(oBatchResponse.response.statusCode);
            }

            if (statusCode >= 300) {
              oIncidentResponse.IncidentStatus = this.IncidentStatus.Error;

              if (oBatchResponse.response.body) {
                var oError = JSON.parse(oBatchResponse.response.body);
                if (
                  oError.error &&
                  oError.error.message &&
                  oError.error.message.value
                ) {
                  oIncidentResponse.MessageLog.push(oError.error.message.value);
                }
              }

              return oIncidentResponse;
            }

            if (
              !oBatchResponse.__changeResponses ||
              oBatchResponse.__changeResponses.length === 0
            ) {
              oIncidentResponse.MessageLog.push(
                "An unexpected error occurred while trying to connect to SAP"
              );
              return oIncidentResponse;
            }

            // Batch responses consist of multiple change responses because SAP hates us:
            for (var j = 0; j < oBatchResponse.__changeResponses.length; j++) {
              var oChangeResponse = oBatchResponse.__changeResponses[j];

              // Evaluate the change response to see if there's a successful incident response:
              var entityUrl = oChangeResponse.headers.location;
              var entitySet = entityUrl.substring(entityUrl.lastIndexOf("/"));
              entitySet = entitySet.substring(1, entitySet.indexOf("("));

              statusCode = parseInt(oChangeResponse.statusCode);

              if (
                entitySet === "Incidents" &&
                statusCode >= 200 &&
                statusCode < 300
              ) {
                oIncidentResponse.HasErrors = false;
                oIncidentResponse.IncidentUUID =
                  oChangeResponse.data.IncidentUUID;
                oIncidentResponse.IncidentID = oChangeResponse.data.IncidentID;
                oIncidentResponse.IncidentStatus =
                  oChangeResponse.data.IncidentStatus;

                return oIncidentResponse;
              }
            }
          }

          return oIncidentResponse;
        },

        /**
         * This method is used to parse the resultant error object so that we have clear details on why the request failed.
         */
        parseBatchError: function (oIncident, oError) {
          var oIncidentResponse = {
            HasErrors: true,
            IncidentUUID: oIncident.IncidentUUID,
            IncidentID: "",
            IncidentStatus: this.IncidentStatus.Error,
            MessageLog: [oError.toString()],
          };

          return oIncidentResponse;
        },

        /**
         * This method is used to fetch the reporting person for the incident.
         */
        getReportingPerson: function (oIncident) {
          return new Promise((resolve, reject) => {
            if (oIncident.RepAnonymInd === true) {
              oIncident.RepPerId = "DEHS_ANONYMS";
              resolve(oIncident);
            } else {
              this.getModel("ehs_utils").callFunction("/GetCurrentUser", {
                success: function (oData, response) {
                  oIncident.RepPerId = `D${oData.GetCurrentUser.UserName}`;
                  resolve(oIncident);
                }.bind(this),
                error: function (oError) {
                  reject(oError);
                }.bind(this),
              });
            }
          });
        },

        /**
         * This method is used to check required fields for an incident prior to submission.
         */
        checkRequiredFields: function (oIncident) {
          debugger;
          var aMessages = [];

          // Determine the list of required fields to validate against:
          var reqFieldMap = new Map([
            [
              "ZEHHSS_NMG_NM_CC",
              [
                "IncidentTitle",
                "IncidentDescriptionOfEvents",
                "IncidentUTCDateTime",
                "EHSLocationUUID",
              ],
            ],
            [
              "ZEHHSS_NMG_STOP_WORK",
              [
                "IncidentTitle",
                "IncidentDescriptionOfEvents",
                "IncidentUTCDateTime",
                "EHSLocationUUID",
                "IncidentLocationDescription",
              ],
            ],
            [
              "ZEHHSS_SOG_SFTY_SUG",
              [
                "EHSLocationUUID",
                "IncidentLocationDescription",
                "IncidentUTCDateTime",
                "IncidentDescriptionOfEvents",
              ],
            ],
            [
              "ZEHHSS_SOG_HAZARD_ID",
              [
                "EHSLocationUUID",
                "IncidentLocationDescription",
                "IncidentUTCDateTime",
                "IncidentDescriptionOfEvents",
              ],
            ],
            // Report Incident
            [
              "EHHSS_IGR_OCC_INC",
              [
                "IncidentDescription",
                "IncidentLocationDescription",
                "IncidentUTCDateTime"
              ],
            ],
            [
              "ZEHHSS_IGR_MVI",
              [
                "IncidentTitle",
                "IncidentDescriptionOfEvents",
                "IncidentUTCDateTime"
              ],
            ],
          ]);

          var aReqFields = reqFieldMap.get(oIncident.NmGroup);

          if (!aReqFields) {
            if (
              !oIncident.IncidentGroup === null ||
              !oIncident.IncidentGroup === ""
            ) {
              aReqFields = reqFieldMap.get(oIncident.SftyObsGroup);
            } else {
              aReqFields = reqFieldMap.get(oIncident.IncidentGroup);
            }
          }

          if (!aReqFields || aReqFields.length === 0) {
            return aMessages;
          }

          //FHASNI: Check Required Fields for Report Incident
          if (this.getView().getViewName() === "Sempra.EHS.Incident.view.ReportIncident"){

          if (oIncident.IncidentTitle == "") {
              aMessages.push("Incident Description (Brief) is a required field");
            }

          if (oIncident.AccidentCatFlag == true && oIncident.AccidentCat == "") {
            aMessages.push("Type is a required field");
          }

          if (oIncident.AccidentCatFlag == true && oIncident.InjPerID == "") {
            aMessages.push("Name is a required field");
          }

          if (oIncident.MviIncidentFlag == true && oIncident.MviIncidentType == "") {
            aMessages.push("Type is a required field");
          }

          if (oIncident.MviIncidentFlag == true && oIncident.VehDrivID == "") {
            aMessages.push("Name is a required field");
          }

          if (sap.ui.getCore().getModel("ReportIncidentView").getProperty("/LocationCompany") == 0 && oIncident.EHSLocationUUID == "") {
            aMessages.push("Company Location is a required field");
          }

          if (sap.ui.getCore().getModel("ReportIncidentView").getProperty("/LocationCompany") == 1 && oIncident.IncidentLocationDescription == "") {
            aMessages.push("Non-Company Location is a required field");
          }

          if (oIncident.MviIncidentFlag == true && oIncident.VehicleCompanyOwned == true && oIncident.LicensePlateID == "") {
            aMessages.push("Vehicle Lic. No is a required field");
          }

          if (oIncident.MviIncidentFlag == true && oIncident.VehicleCompanyOwned == false && (oIncident.LicensePlateID == "" && oIncident.VehicleUnitNo == "")) {
            aMessages.push("Vehicle Unit No or Vehicle Lic. No are required field");
          }
          }
        else {
            aReqFields.forEach(
              function (sReqField) {
                var oValue = oIncident[sReqField];

                if (!oValue) {
                  var sFieldLabel = "";

                  var oControl = this.byId(`inp${sReqField}`);
                  if (oControl) {
                    var oLabel = this.byId(`lbl${sReqField}`);

                    if (oLabel) {
                      sFieldLabel = oLabel.getText();
                    } else {
                      sFieldLabel = "This field";
                    }
                  }

                  aMessages.push(`${sFieldLabel} is a required field`);
                }
              }.bind(this)
            );

            if (oIncident.ImpOther && oIncident.ImpOtherDesc == "") {
              aMessages.push("Describe other is a required field");
            }

            if (oIncident.PrimCause == "008" && oIncident.PrimOthDesc == "") {
              aMessages.push("Describe other is a required field");
            }
  
            if (oIncident.SecCause == "008" && oIncident.SecOthDesc == "") {
              aMessages.push("Describe other is a required field");
            }
  
            if (oIncident.OrgOther && oIncident.OrgOtherDesc == "") {
              aMessages.push("Describe other is a required field");
            }
  
            if (oIncident.ResolvedNo && oIncident.ResExplain == "") {
              aMessages.push("Explain is a required field");
            }
          }
          return aMessages;
        },

        /**
         * This method is used to open up a file explorer dialog box.
         */
        onOpenFileExplorer: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext();
          if (!this.oFileDialog) {
            Fragment.load({
              name: "Sempra.EHS.Incident.fragment.FileDialog",
              controller: this,
            }).then(
              function (oDialog) {
                this.oFileDialog = oDialog;
                this.getView().addDependent(this.oFileDialog);
                this.oFileDialog.bindElement(oContext.getPath());
                this.oFileDialog.open();
              }.bind(this)
            );
          } else {
            this.oFileDialog.bindElement(oContext.getPath());
            this.oFileDialog.open();
          }
        },

        /**
         * This method is used to close the file explorer dialog box.
         */
        closeFileDialog: function () {
          if (this.oFileDialog != null) {
            this.oFileDialog.close();
            this.getView().removeDependent(this.oFileDialog);
            this.oFileDialog.destroy();
            this.oFileDialog = null;
          }
        },

        /**
         * This method is used to respond to attachment open requests.
         */
        onAttachmentPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext();
          var oAttach = oContext.getObject();

          var oBlob = new Blob([oAttach.content], {
            type: oAttach.ContentType,
          });
          var url = URL.createObjectURL(oBlob);
          window.open(url, "_blank");
        },

        /**
         * This method is used to process the upload of an attachment record.
         */
        onAttachmentsUploaderChange: function (oEvent) {
          this.closeFileDialog();
          // Fetch details about the selected attachment file into context:
          if (!oEvent.getParameter("files")) {
            return;
          }

          var oFileList = oEvent.getParameter("files");
          var oUploadedFile = oFileList.item(0);

          // Check to see if the file is a video file:
          if (oUploadedFile.type.indexOf("video/") === 0) {
            MessageBox.error("You cannot upload video files using this app");
            return;
          }

          // Store the uploaded attachment:
          var oIncident = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getObject();

          return oUploadedFile.arrayBuffer().then(
            function (oArrayBuffer) {
              // Create a new attachment object:
              var oAttach = {
                UUID: this.generateUUID(),
                ParentUUID: oIncident.UUID,
                content: oArrayBuffer,
                Filename: oUploadedFile.name,
                Filesize: oUploadedFile.size,
                ContentType: oUploadedFile.type,
                CreatedAt: oUploadedFile.lastModifiedDate,
                createdOffline: !window.navigator.onLine,
              };

              // Add the attachment record to the in-memory incident JSON model:
              oIncident.Attachments.push(oAttach);
              this.getModel().setProperty("/Incident", oIncident);
              this.byId("attachmentsTitle").setText(
                "Attachments (" + oIncident.Attachments.length + ")"
              );

              // Then save the attachment to IDB:
              return this.IDBUtils.updateIDBRecord(
                "attachmentstore",
                oAttach,
                oAttach.UUID
              );
            }.bind(this)
          );
        },

        /**
         * This method is used to process deletion requests for attachment records.
         */
        onAttachmentDeleted: function (oEvent) {
          if (this.byId("AttachmentsList").getSelectedItem() === null) {
            MessageBox.error("Please select an attachment to delete first");
            return;
          }

          // Retrieve the selected attachment object:
          var sPath = this.byId("AttachmentsList")
            .getSelectedItem()
            .getBindingContext().sPath;
          var oAttachment = this.getModel().getProperty(sPath);

          // Remove the attachment from the in-memory incident JSON model:
          var oIncident = this.getView()
            .getElementBinding()
            .getBoundContext()
            .getObject();

          oIncident.Attachments = oIncident.Attachments.filter((attachment) => {
            return attachment.UUID != oAttachment.UUID;
          });

          this.getModel().setProperty(
            "/Incident/Attachments",
            oIncident.Attachments
          );
          this.byId("attachmentsTitle").setText(
            "Attachments (" + oIncident.Attachments.length + ")"
          );

          // Then, remove the attachment from the IDB store:
          return this.IDBUtils.getRecordFromIDB("attachmentstore", {
            UUID: oAttachment.UUID,
            ParentUUID: oIncident.IncidentUUID,
          })
            .then(
              function (response) {
                return this.IDBUtils.deleteIDBRecord(
                  "attachmentstore",
                  response.key
                );
              }.bind(this)
            )
            .catch((err) => {
              MessageBox.error(
                "An unexpected error occurred while trying to remove the attachment"
              );
            });
        },

        /**
         * This method is used to ensure that users can't write in their own bogus location classifications.
         */
        handleLocClassChange: function (oEvent) {
          var oValidatedComboBox = oEvent.getSource(),
            sSelectedKey = oValidatedComboBox.getSelectedKey(),
            sValue = oValidatedComboBox.getValue();

          if (!sSelectedKey && sValue) {
            oValidatedComboBox.setValueState("Error");
            oValidatedComboBox.setValueStateText(
              "Please select a valid Location Classification from dropdown list!"
            );
          } else {
            oValidatedComboBox.setValueState("None");
          }
        },

        /**
         * This method is used to process location value help requests.
         */
        onLocationValueHelp: function (oEvent) {
          var filters = new Map([
            ["ZEHHSS_NMG_NM_CC", "ALL"],
            ["ZEHHSS_NMG_STOP_WORK", "ALL"],
            ["ZEHHSS_SOG_SFTY_SUG", "ZEHHSS_SOG_SFTY_SUG"],
            ["ZEHHSS_SOG_HAZARD_ID", "ZEHHSS_SOG_HAZARD_ID"],
            // Report Incident
            ["EHHSS_IGR_OCC_INC", "ALL"],
            ["ZEHHSS_IGR_MVI", "ALL"],
          ]);

          var aIncidents = this.getModel().getProperty("/Incidents");
          var filter =
            aIncidents[aIncidents.length - 1].SftyObsGroup != ""
              ? aIncidents[aIncidents.length - 1].SftyObsGroup
              : aIncidents[aIncidents.length - 1].NmGroup
              ? aIncidents[aIncidents.length - 1].NmGroup
              : aIncidents[aIncidents.length - 1].IncidentGroup;

          var oInput = oEvent.getSource();

          var oDialog = this.byId("locationValueSelectDialog");
          if (!oDialog) {
            oInput.setBusy(true);
            Fragment.load({
              id: this.getView().getId(),
              name: "Sempra.EHS.Incident.fragment.Location",
              controller: this,
            })
              .then(
                function (oLocationDialog) {
                  oDialog = oLocationDialog;
                  return this._populateLocations();
                }.bind(this)
              )
              .then(
                function (response) {
                  oInput.setBusy(false);
                  this.getView().addDependent(oDialog);
                  var aFilters = [
                    new Filter("SftyObsGroup", "EQ", filters.get(filter)),
                  ];
                  this.byId("locationValueSelectDialog")
                    .getBinding("items")
                    .filter(aFilters);

                  if (filter == "ZEHHSS_SOG_SFTY_SUG") {
                    this.byId("locationValueSelectDialog").setTitle(
                      "Select Facility"
                    );
                  }

                  if (filter == "ZEHHSS_SOG_HAZARD_ID") {
                    this.byId("locationValueSelectDialog").setTitle(
                      "Select Department"
                    );
                  }

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
         * This method is used to load location master data into context.
         */
        _populateLocations: function () {
          if (!this._bLocationsPopulated) {
            return new Promise(
              function (resolve, reject) {
                this.getModel("sap_ro").read("/Locations", {
                  success: function (oResponse) {
                    this._bLocationsPopulated = true;
                    var aLocations = [
                      {
                        LocationName: "No Location",
                        LocationUUID: "",
                      },
                    ];
                    aLocations = aLocations.concat(oResponse.results);

                    var oModel = this.getModel().getProperty("/");
                    oModel.Locations = aLocations;
                    this.getOwnerComponent()
                      .getModel()
                      .setProperty("/", oModel);
                    resolve();
                  }.bind(this),

                  error: function (err) {
                    MessageBox.error("Failed to load locations");
                    reject(err);
                  },
                });
              }.bind(this)
            );
          } else {
            return Promise.resolve();
          }
        },

        /**
         * This method is used to allow the user to search through the location list.
         */
        onSearchLocations: function (oEvent) {
          var aFilters = [
            new Filter(
              "LocationName",
              "Contains",
              oEvent.getParameter("value")
            ),
          ];
          this.byId("locationValueSelectDialog")
            .getBinding("items")
            .filter(aFilters);
        },

        /**
         * This method is used to copy selected locations into the selected incident record.
         */
        onConfirmLocation: function (oEvent) {
          debugger;
          var oSelectedItem = oEvent.getParameter("selectedItem");
          if (oSelectedItem) {
            var oLocation = oSelectedItem.getBindingContext().getObject();

            var sPath = this.getView()
              .getElementBinding()
              .getBoundContext()
              .getPath();
            this.getModel().setProperty(
              sPath + "/EHSLocationUUID",
              oLocation.LocationUUID
            );

            this.byId("inpEHSLocationUUID").setValue(
              oLocation.LocationName === "No Location"
                ? ""
                : oLocation.LocationName
            );
          }
        },

        /**
         * This method is used to format an incident number for output.
         */
        getFormattedIncidentNo: function (sIncidentNumber) {
          try {
            var nFormatted = parseInt(sIncidentNumber, 10);
            return nFormatted.toString();
          } catch (err) {
            return sIncidentNumber;
          }
        },

        /**
         * This method is used to check the value state of the location field on the form.
         */
        checkLocationValueState: function (oEvent) {
          var oControl = oEvent.getSource();
          var sValue = oControl.getValue();
          var sSelectedKey = oControl.getSelectedKey();
          var bValid = sValue !== "" && sSelectedKey !== "";

          if (!bValid) {
            oControl.setValue("");
          }
        },

        /**
         * This method is used to check the value state of the date field on the form.
         */
        checkDateValueState: function (oEvent) {
          var oControl = oEvent.getSource();
          var sValue = oControl.getValue();
          var bValid =
            new Date(sValue) instanceof Date && !isNaN(new Date(sValue));

          if (!bValid) {
            oControl.setDateValue(new Date());
          }
        },

        /**
         * This method is used to clear old events out of the cache after a defined period of time has elapsed.
         */
        clearOldEvents: function () {
          // Local Data Declarations:
          var today = new Date().getTime();
          var refTime = today - this.CACHE_TIME_TO_LIVE;

          // Fetch the current incident record list from IDB:
          return this.IDBUtils.getAllIncidentsFromIDB("incidentstore")
            .then(
              function (response) {
                return response.filter(
                  function (incident) {
                    // Filter out any event records that are older than the reference date that aren't in error:
                    if (
                      incident.IncidentCreationUTCDateTime < refTime &&
                      incident.IncidentStatus !== this.IncidentStatus.Error &&
                      incident.IncidentStatus !== this.IncidentStatus.Pending &&
                      incident.IncidentStatus !== this.IncidentStatus.Draft
                    ) {
                      return incident;
                    }
                  }.bind(this)
                );
              }.bind(this)
            )
            .then(
              function (oldIncidents) {
                // Find all child attachments with this UUID:
                return Promise.all([
                  oldIncidents,
                  Promise.all(
                    oldIncidents.map(
                      function (incident) {
                        return this.IDBUtils.getAllAttachmentsByIncidentFromIDB(
                          "attachmentstore",
                          incident.UUID
                        );
                      }.bind(this)
                    )
                  ),
                ]);
              }.bind(this)
            )
            .then(
              function (response) {
                // Remove the attachments we find from the IDB cache:
                return Promise.all([
                  response[0],
                  Promise.all(
                    response[1].map(
                      function (attachments) {
                        return attachments.map(
                          function (attachment) {
                            return this.IDBUtils.deleteIDBRecord(
                              "attachmentstore",
                              attachment.UUID
                            );
                          }.bind(this)
                        );
                      }.bind(this)
                    )
                  ),
                ]);
              }.bind(this)
            )
            .then(
              function (response) {
                // Finally, delete the event record itself:
                return Promise.all(
                  response[0].map(
                    function (incident) {
                      return this.IDBUtils.deleteIDBRecord(
                        "incidentstore",
                        incident.UUID
                      );
                    }.bind(this)
                  )
                );
              }.bind(this)
            )
            .catch(function (err) {
              Log.error(err);
            });
        },

        /**
         * This method is used to clean up orphaned attachments that may be lurking in the IDB cache.
         */
        clearOrphanAttachments: function () {
          var oModel = this.getModel();
          var aIncidents = oModel.getProperty("/Incidents");
          var UUID = aIncidents[aIncidents.length - 1].UUID;

          return Promise.all(
            oldIncidents.map(
              function (incident) {
                return this.IDBUtils.getAllAttachmentsByIncidentFromIDB(
                  "attachmentstore",
                  UUID
                );
              }.bind(this)
            )
          ).then(function (attachments) {
            return Promise.all(
              arrResponse[1].map(
                function (attachments) {
                  attachments.map(
                    function (attachment) {
                      return this.IDBUtils.deleteIDBRecord(
                        "attachmentstore",
                        attachment.UUID
                      );
                    }.bind(this)
                  );
                }.bind(this)
              )
            );
          });
        },
      }
    );
  }
);
