function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var projects = ss.getSheetByName('Projects');
  var inventory = ss.getSheetByName('Inventory');
  var rowsP = projects.getDataRange().getValues();
  var headersP = rowsP.shift();
  var dataP = rowsP.map(function(r,i){ var o={}; headersP.forEach(function(h,j){ o[h]=r[j]; }); o.id=String(i+1); return o; });
  var rowsI = inventory.getDataRange().getValues();
  var headersI = rowsI.shift();
  var dataI = rowsI.map(function(r,i){ var o={}; headersI.forEach(function(h,j){ o[h]=r[j]; }); o.id=String(i+1); return o; });
  var endpoint = (e.parameter.endpoint || '').toString();
  if(endpoint === 'projects') return ContentService.createTextOutput(JSON.stringify(dataP)).setMimeType(ContentService.MimeType.JSON);
  if(endpoint === 'inventory') return ContentService.createTextOutput(JSON.stringify(dataI)).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify({error:'Invalid endpoint'})).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var projects = ss.getSheetByName('Projects');
  var body = JSON.parse(e.postData.contents || '{}');
  if(body.action === 'addProject' && body.data) {
    var headers = projects.getDataRange().getValues()[0];
    var row = headers.map(function(h){ return body.data[h] || ''; });
    projects.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({success:false})).setMimeType(ContentService.MimeType.JSON);
}