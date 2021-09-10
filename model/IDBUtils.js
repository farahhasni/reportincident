sap.ui.define([], function() {
	"use strict";
	
	return {
		/**
		 * This method is used to add a document to the selected object store.
		 */
		addToIDB: function (objectStore, data) {
			return new Promise(function(resolve, reject) {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(objectStore, "readwrite");
					var objectstore = transaction.objectStore(objectStore);
					var request = objectstore.add(data);
					
					transaction.onerror = function(err) {
						reject(err);
					};
					
					objectstore.onerror = function(err) {
						reject(err);
					};
					
					request.onerror = function(err) {
						reject(err);
					}
					
					request.onsuccess = function(event) {
                        data.idbPrimaryKey = event.target.result;
                        var update = objectstore.put(data, event.target.result);

                        update.onsuccess = function(event) {
                            resolve(data);
                        }

                        update.onerror = function(err) {
                            reject(err);
                        }
                    }
				};
				
				db.onerror = function(err) {
					reject(err);
				};
			});
		},
		
		/**
		 * This method is used to update a record in the selected table in IDB.
		 */
		updateIDBRecord: function (objectStore, data, key) {
			return new Promise(function(resolve, reject) {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(objectStore, "readwrite");
					var objectstore = transaction.objectStore(objectStore);
					
					if (key) {
						var request = objectstore.put(data, key);	
					} else {
						var request = objectstore.put(data);
					}
					
					transaction.onerror = function(err) {
						reject(err);
					};
					
					objectstore.onerror = function(err) {
						reject(err);
					};
					
					request.onerror = function(err) {
						reject(err);
					}
					
					request.onsuccess = function(event) {
                        resolve(event.target.result);
                    }
				};
				
				db.onerror = function(err) {
					reject(err);
				};
			});
		},
		
		/**
		 * This method is used to save a document to the selected document store.
		 */
		saveToIDB: function(objectStore, data) {
			return new Promise(function(resolve, reject) {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(objectStore, "readwrite");
					var objectstore = transaction.objectStore(objectStore);
					
					if (Array.isArray(data)) {
						data.forEach(function(datum) {
							objectstore.put(datum)
						})
					} else {
						objectstore.put(data);
					}
					
					transaction.oncomplete = function(event) {
						resolve(event);
					};
					
					transaction.onerror = function(err) {
						if (err.target.error.name == 'ConstraintError') {
							resolve();
							return;
						}
						
						reject(err);
					};
					
					objectstore.onsuccess = function(event) {
						resolve()
					}
				};
				
				db.onerror = function(err) {
					reject(err);
				};
			});
		},
		
		/**
		 * This method is used to retrieve all records from an object store.
		 * @param {*} sTableName 
		 * @returns 
		 */
		getAllRecordsFromTable: function(sTableName) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readwrite");
					
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore(sTableName);
					
					var records = objectstore.getAll();
					
					records.onsuccess = function(event) {
						resolve(event.target.result)
					}
				}
				
				db.onerror = function(err) {
					reject(err);	
				}
			});
		},

		/**
		 * This method is used to fetch all of the incidents currently cached in IDB.
		 */
		getAllIncidentsFromIDB: function(sTableName) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readwrite");
					
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore(sTableName);
					
					var records = objectstore.getAll();
					
					records.onsuccess = function(event) {
						resolve(event.target.result)
					}
				}
				
				db.onerror = function(err) {
					reject(err);	
				}
			})
		},
		
		/**
		 * This method is used to fetch all of the attachments for an incident from IDB.
		 */
		getAllAttachmentsByIncidentFromIDB: function(sTableName, sUUID) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					// the array we will resolve with at the end
					var aAttachments = [];
					
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readwrite");
					
					transaction.onerror = function(err) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore(sTableName);
					var cursor = objectstore.openCursor();
					
					cursor.onsuccess = function(event) {
						var record = event.target.result;
						
						if(record) {
							if(record.value.ParentUUID == sUUID) {
								aAttachments.push(record.value);
							}
							
							// continue
							record.continue();
						} else {
							resolve(aAttachments);
						}
					}
					
					cursor.onerror = function(err) {
						reject(err);
					}
					
				}
				
				db.onerror = function(err) {
					reject(err);
				}
			})
		},
		
		/**
		 * This method is used to fetch a record from the selected table in IDB.
		 */
		getRecordFromIDB: function(sTableName, oCompositeKey) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readwrite");
					
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore(sTableName);
					var aKeys = Object.keys(oCompositeKey);
					
					var cursor = objectstore.openCursor();
					cursor.onsuccess = function(event) {
						var record = event.target.result;
						
						if (record) {
							// match always starts as true, and if _any_ part of the composite doesn't match, it will be set to false
							var match = true;
							
							// loop over record keys and compare to oCompositekey values
							for (var i = 0; i < aKeys.length; i++) {
								// check if the value is a date obj
								if (record.value[aKeys[i]] instanceof Date) {
									// test getTime between the current record and the passed in date
									if (record.value[aKeys[i]].getTime() != oCompositeKey[aKeys[i]].getTime()) {
										match = false;
									}
									
									// we don't want to test the other options if its a date obj
									break;
								}
								
								if (!record.value[aKeys[i]]) {
									match = false;
									break;
								}
								
								if (record.value[aKeys[i]] != oCompositeKey[aKeys[i]]) {
									match = false;
									break;
								}
							}
							
							// if there is a match, resolve with this record
							if (match === true) {
								resolve(record);
								return;
							}
							
							record.continue();
							
						} else {
							resolve(null);
						}
					}
					
					cursor.onerror = function(err) {
						reject(err);
					}
				}
				
				db.onerror = function(err) {
					reject(err);
				}
			})
		},
		
		/**
		 * This method is used to delete a record from the selected table in IDB.
		 */
		deleteIDBRecord: function(sTableName, idbKey) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readwrite");
					var objectstore = transaction.objectStore(sTableName);
					
					var deleteRecord = objectstore.delete(idbKey);
					
					deleteRecord.onsuccess = function() {
						resolve();
					}
				}
				
				db.onerror = function(err) {
					reject(err);
				}
			});
		},

		/**
		 * This method is used to determine if a given table contains any records.
		 */
		hasRecords: function(sTableName) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction(sTableName, "readonly");
					transaction.onerror = function(error) {
						reject(err)
					};
					
					var objectstore = transaction.objectStore(sTableName);
					
					objectstore.openCursor().onsuccess = function(event) {
						var cursor = event.target.result;
						
						if (cursor) {
							resolve(true);
						}
						else {
							resolve(false);
						}
					};
				};
				
				db.onerror = function(err) {
					reject(err);
				};
			});
		},
		
		/**
		 * This method cleans up unsiaved data from the IDB cache.
		 */
		clearUnsavedIDBData: function(aIncidents) {
			return Promise.all(aIncidents.map(function (incident) {
				return this.getRecordFromIDB('incidentstore', { 'IncidentUTCDateTime': incident.data.IncidentUTCDateTime })
			}.bind(this)))
			.then(function(response) {
				return Promise.all(response.map(function(record) {
					return this.getRecordFromIDB('attachmentstore', { 'UUID': record.value.IncidentUUID})
				}.bind(this)))
				.then(function(attachmentResponse) {
					var arr = attachmentResponse.filter((attach) => {return attach}).concat(response);
					
					return Promise.all(arr.map(function(record) {
						return this.deleteIDBRecord(record.source.name, record.key);
					}.bind(this)))
				}.bind(this))
			}.bind(this));
		},
		
		/**
		 * This method is used to fetch an incident from IDB by its EHSM UUID.
		 */
		getIncidentByEHSId: function(incidentUUID) {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction('incidentstore', "readonly");
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore('incidentstore');
					
					objectstore.openCursor().onsuccess = function(event) {
						var cursor = event.target.result;
						
						if (cursor) {
							if (cursor.value.IncidentUUID === incidentUUID)	{
								resolve(cursor.value);
							}
							else {
								cursor.continue();
							}
						}
						else {
							resolve({});
						}
					};
				}
				
				db.onerror = function(err) {
					reject(err);	
				}
			})	
		},
		
		/**
		 * This method is used to check to see if there are incidents in the queue
		 * waiting to be synced up with SAP EHSM.
		 */
		hasUnsubmittedIncident: function() {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction('incidentstore', "readonly");
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore('incidentstore');
					
					objectstore.openCursor().onsuccess = function(event) {
						var cursor = event.target.result;
						
						if (cursor) {
							switch (cursor.value.IncidentStatus) {
								case "":
								case "98":
								case "99":
									resolve(true);
								default:
									cursor.continue();
							}
						}
						else {
							resolve(false);
						}
					};
				}
				
				db.onerror = function(err) {
					reject(err);	
				}
			})
		},

		/**
		 * This method is used to fetch the current user from the IDB cache.
		 */
		getCurrentUser: function() {
			return new Promise((resolve, reject) => {
				var db = window.indexedDB.open('IncidentDB');
				
				db.onsuccess = function(event) {
					var idb = event.target.result;
					
					var transaction = idb.transaction('GetCurrentUser', "readonly");
					transaction.onerror = function(error) {
						reject(err)
					}
					
					var objectstore = transaction.objectStore('GetCurrentUser');
					
					objectstore.openCursor().onsuccess = function(event) {
						var cursor = event.target.result;
						
						if (cursor) {
							resolve(cursor.value);
						}
						else {
							resolve(false);
						}
					};
				}
				
				db.onerror = function(err) {
					reject(err);	
				}
			})
		}
	}
});