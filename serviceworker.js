// Global Imports:
importScripts("./js/core-js.js");

// Global Constants:
const cacheName = 'incident-v0.1';
const serviceURI = "/sap/opu/odata/sap/EHS_INC_REPORTINCIDENT_SRV";
const flpServiceURI = "/sap/opu/odata/UI2/PAGE_BUILDER_PERS";
const utilsURI = "/sap/opu/odata/sap/ZEHS_INC_COMMON_SRV";
const idbTables = ["GetCurrentUser", "LocationClassifications", "Locations", "Catalog", "SearchPersonSet","MviIncTypeCodeSet"];
                //    ,"MviType","Persons"]; --> Report Incident

// Web resources to be loaded into Cache Storage:
var resourcesToPrecache = [
     'index.html',
     'manifest.webmanifest',
     'manifest.json',
     'manifest.json?sap-language=EN',
     'manifest.webmanifest',
     'css/style.css',
	 'js/core-js.js',
	 'img/favicon.ico',
     
     // Bundled Libraries:
     'https://sapui5.hana.ondemand.com/resources/sap-ui-core.js',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/core/library-preload.js',
     'https://sapui5.hana.ondemand.com/resources/sap/m/library-preload.js',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/layout/library-preload.js',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/unified/library-preload.js',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/thirdparty/datajs.js',
	 'https://sapui5.hana.ondemand.com/resources/sap/ui/core/messagebundle_en.properties',
	 'https://sapui5.hana.ondemand.com/resources/sap/ui/model/odata/v2/ODataModel.js',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/model/odata/ODataMetadata.js',
     'Component-preload.js',
     
     // Styles:
     'https://sapui5.hana.ondemand.com/resources/sap/ui/unified/themes/sap_fiori_3/library.css',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/core/themes/sap_fiori_3/library.css',
     'https://sapui5.hana.ondemand.com/resources/sap/ui/layout/themes/sap_fiori_3/library.css',
     'https://sapui5.hana.ondemand.com/resources/sap/m/themes/sap_fiori_3/library.css',
     
     // Fonts:     
     'https://sapui5.hana.ondemand.com/resources/sap/ui/core/themes/base/fonts/SAP-icons.woff2',
     'css/fonts/sap-launch-icons.eot',
	 'css/fonts/sap-launch-icons.ttf'     
];

/**
 * Event handler for the Service Worker "install" event which gets triggered whenever the PWA
 * app is initially loaded. It is used here to pre-fetch UI5 app content needed to operate the
 * app while offline.
 */
self.addEventListener('install', event => {
	event.waitUntil(
      caches.open(cacheName).then(function(cache) {
      		resourcesToPrecache = resourcesToPrecache.concat([
			     `${self.location.origin}${serviceURI}/$metadata`,
			     `${self.location.origin}${flpServiceURI}/$metadata`,
				 `${self.location.origin}${utilsURI}/$metadata`
		     ])
      		return Promise.allSettled(resourcesToPrecache.map(function(resource) {
      			return cache.add(resource);
      		}))
      		.then(function(cacheResponse) {
      			// TODO: Conditional response handling at a future date???
      		})
          }).then(function() {
				return self.skipWaiting();
          }).catch(function(err) {
				// Should not happen...
				console.log(err);
          })
	  )
});

/**
 * This callback method is used to update the app cache in Cache Storage.
 */
self.addEventListener('activate', event => {
     const cacheAllowlist = [cacheName];
     event.waitUntil(
          caches.keys().then(function(cacheNames) {
          	   return Promise.all(
                    cacheNames.map(function(name) {
                         if (cacheAllowlist.indexOf(name) === -1) {
                              return caches.delete(name);
                         }
                    })
               );
          }).then(function() {
          	return self.clients.claim()
          	.then(() => {
          		return self.clients.matchAll()
          		.then((response) => {
          			// Send a message to the app letting it know that the app is loaded:
          			return clients.get(response[0].id)
          			.then((client) => {
          				if (!client) { return; }
          				
          				client.postMessage({
          					msg: "hello from activate!"
          				});
          			})
          		})
          	})          	
          	.then(function(response) {
          		return Promise.allSettled(response.map((rez) => {
          			return rez.value.json()
          		}))
          	})
          	.then(function(arrResponse) {} )
          }).then(function() {})
          .catch((err) => {})
     );
});

/**
 * This method is used to intercept outgoing fetch requests triggered from the app.
 */
self.addEventListener('fetch', function (event) {
	console.log(event.request.url);

	 event.respondWith(
          caches.open(cacheName).then(function (cache) {
          	// Handle specific request types based on the target method:
			if (event.request.method === 'HEAD') {
				if (navigator.onLine) {
					return fetchWithTimeout(event.request);
				}
				else {
					// This is probably a request for a CSRF token:
					return new Response("", {
						headers: {
							"Content-Type": "text/html",
							"Content-Length": 0,
							"x-csrf-token": ""
						}
					});
				}
			}
			else if (event.request.method !== 'GET') {
				// Process all non-GET requests as per usual (but with a timeout):
          		return fetchWithTimeout(event.request);
      		}
			
			// Apply specialized handling for requests to any of the OData endpoints:
			if (event.request.url.includes(serviceURI) || event.request.url.includes(utilsURI) || event.request.url.includes(flpServiceURI)) {
				// If it is not a request for metadata, try to fetch the data from IDB:
				if (!event.request.url.includes("$metadata")) {
					// first attempt a fetch request
					// if that works, attempt to update IDB
					return fetchWithTimeout(event.request)
					.then(function(response) {
						if (response.status >= 400) {
							throw new Error("Error in web response");
						}
						
						var tmp = response.clone();
						
						return tmp.json()
						.then(function(jsonResponse) {
							var table = idbTables.find((t) => { return event.request.url.includes(t) });
							
							if (table === 'GetCurrentUser') {
								return saveToIDB(table, jsonResponse.d.GetCurrentUser)
								.then(function() { return response; })
								.catch((err) => { console.warn(err); })
							}
							
							return Promise.all(jsonResponse.d.results.map(function(result) {
								return saveToIDB(table, result);	
							}))
							.then(() => { return response; })
							.catch((err) => { console.warn(err); })
						})
						.catch((err) => { console.warn(err); })
					})
					.catch(function(err) {
						// If this request fails, try to serve up the content from IDB:
						console.warn(err);
						
						var table = idbTables.find((t) => { return event.request.url.includes(t) });
						
						if (!table || table === "") {
							if (event.request.url.includes("PAGE_BUILDER_PERS/Catalogs")) {
								table = "Catalog";
							}
						}
						
						if (table) {
							return getAllRecordsByTableFromIDB(table)
							.then(function(records) {
								if (table === 'GetCurrentUser') {
									var init = { "status" : 299 , "statusText" : "Custom service worker response" };
									return new Response(new Blob([JSON.stringify({"d": { "GetCurrentUser": records[0] } }, null, 2)], {type : 'application/json'}), init);
								}
								else {							
									var init = { "status" : 299 , "statusText" : "Custom service worker response" };
									return new Response(new Blob([JSON.stringify({"d": { "results": records }}, null, 2)], {type : 'application/json'}), init);
								}
							})
							.catch((err) => {console.log(err);})
						}
					})
				}
			}

			// Handle requests to index.html so that online requests always trigger a redirect to the SAML 2.0 logon page where needed:
			if (navigator.onLine) {
				if (event.request.url.includes("index.html")) {
					return fetchWithTimeout(event.request)
					.catch((e) => {
						return cache.match(event.request).then(function (response) {
							return response;
						});
					});
				}
			}

			// Handle OData metadata requests to deal with weird redirects:
			var re = new RegExp("^.*/\\$metadata\\?.+$");
			var requestUrl = new URL(event.request.url);

			if (re.test(event.request.url)) {
				var url = new URL(event.request.url);
				requestUrl = url.origin + url.pathname;
			}
			
			// For all other types of requests, first try to serve from cache and fallback on a fetch:			
			return cache.match(requestUrl).then(function (response) {
           	    return response || fetchWithTimeout(requestUrl).then(function (response) {
                	// Only cache content where we received a successful response:
                	if (response.status >= 200 && response.status < 300) {
                		cache.put(requestUrl, response.clone());	
                	}
                	
                    return response;
                });
           });
    	})
     )
});

/**
 * This method is used to enforce a timeout for long-running requests to the SAP backend.
 */
function fetchWithTimeout(request) {	
	var timeout = 180000;                        // 3 * 60 * 1000 = 3 Minutes
	
	return Promise.race([
		fetch(request),
		new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(
					new Error(`Request for ${request.url} timed out!`)
				)
			}, timeout)
		})
	])
}

/**
 * This method is used to run a wide open lookup in IndexedDB to serve up cache data.
 */
function getAllRecordsByTableFromIDB(sTableName) {
	return new Promise((resolve, reject) => {
		var db = indexedDB.open('IncidentDB');
		
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
}

/**
 * This method is used to store records in IndexedDB. 
 */
function saveToIDB(objectStore, data) {
	return new Promise(function(resolve, reject) {
		var db = indexedDB.open('IncidentDB');
		
		db.onsuccess = function(event) {
			var idb = event.target.result;
			
			var transaction = idb.transaction(objectStore, "readwrite");
			var objectstore = transaction.objectStore(objectStore);
			objectstore.put(data);
			
			transaction.oncomplete = function(event) {
				resolve(event);
			};
			
			transaction.onerror = function(err) {
				reject(err);
			};
			
			objectstore.onsuccess = function(event) {
				resolve()
			};
			
			objectstore.onerror = function(err) {
				reject(err);
			};
		};
		
		db.onerror = function(err) {
			reject(err);
		};
	});
}