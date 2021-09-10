/**
 * This file defines a Web Worker that will process attachment uploads in
 * a separate thread in order to improve performance with the app.
 */
self.addEventListener('message', function(e) {
    // Local variable declarations:
    var oMessage = e.data;
    var requestCount = oMessage.Attachments ? oMessage.Attachments.length : 0;
    var uploadCount = 0;

    // Try to upload each of the attachments one-by-one:
    oMessage.Attachments.forEach(function(attachment) {
    	var xhrAttach = new XMLHttpRequest();
    
	    xhrAttach.onreadystatechange = function() {
	    	if (xhrAttach.readyState === XMLHttpRequest.DONE && xhrAttach.status === 201) {
	    		uploadCount += 1;
	    		
	    		if (uploadCount === requestCount) {
	    			// Call a function import to let SAP EHSM know that all attachments have been processed:
	    			var xhrFn = new XMLHttpRequest();
	        		
	        		var url = "/sap/opu/odata/sap/EHS_INC_REPORTINCIDENT_SRV/SetUploadComplete" +
	        		          "?IncidentKey=guid%27" + oMessage.IncidentUUID + "%27";
	        		xhrFn.open("POST", url, true);
	        		
	        		xhrFn.setRequestHeader("X-Requested-With", "XMLHttpRequest");
	        		xhrFn.setRequestHeader("Content-Type", "application/json");
					xhrFn.setRequestHeader("x-csrf-token", oMessage.CSRFToken);
	            
	            	xhrFn.onreadystatechange = function() {
	            		if (xhrFn.readyState === XMLHttpRequest.DONE) {
	            			// Post a message back to the main thread letting it know that the upload process is completed:
	    					postMessage({"IncidentUUID": oMessage.IncidentUUID});
	            		}
	            	};
	            	
	            	xhrFn.send();
	    		}	
	    	}
	    };
	    
        // Trigger the upload process:
        xhrAttach.open("POST", "/sap/opu/odata/sap/EHS_INC_REPORTINCIDENT_SRV/MobileAttachmentSet", true);
        
        xhrAttach.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		xhrAttach.setRequestHeader("x-csrf-token", oMessage.CSRFToken);
        xhrAttach.setRequestHeader("Content-Type", attachment.ContentType);
        xhrAttach.setRequestHeader("Content-Encoding", "base64");
        xhrAttach.setRequestHeader("slug", oMessage.IncidentUUID + "," + attachment.Filename);
        
        xhrAttach.send(attachment.Content);
    });
});