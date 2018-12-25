var csInterface = new CSInterface();
var ks = '';
var uploadTokenId = '';
var entryId = '';
var filename = '';

$('#login-button').on('click', login);
$('#download-button').on('click', download);
$('#upload-button').on('click', upload);
$('#export-button').on('click', exportClip);

function login(){
  const user = $('#user').val();
  const pass = $('#pass').val();
  $.post( "https://www.kaltura.com/api_v3/service/user/action/loginByLoginId", {
      format: 1,
      loginId: user,
      password: pass
  }, function( data ) {
      if (data.message){
          alert(data.message); // login error
      } else {
          $("#login").hide();
          $("#entriesList").show();
          ks = data;
          listEntries();
      }
  });
}


function listEntries(){
    $.post( "https://www.kaltura.com/api_v3/service/baseentry/action/list", {
        format: 1,
        ks: ks,
        filter: {
            typeEqual: 1,
            // nameMultiLikeOr: 'Kaltura Logo'
        },
        responseProfile: {
            type: 1,
            objectType: "KalturaDetachedResponseProfile",
            fields: "id,name,thumbnailUrl,mediaType,downloadUrl"
        }
    }, function( data ) {
        var entries = data.objects;
        for (var i=0; i<entries.length; i++){
            var entry = data.objects[i];
           $("#entries").append('<li><img src="'+entry.thumbnailUrl+'"/><span class="entryName">'+entry.name+'</span><button onclick="download(\''+entry.downloadUrl+'\',\''+entry.name+'\')">Open</button></li>');
        }
    });
}

function download(src, name){
    filename = name;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function (e) {
        if (this.status == 200 || this.status == 304) {
            var uInt8Array = new Uint8Array(this.response);
            var i = uInt8Array.length;
            var binaryString = new Array(i);
            while (i--) {
                binaryString[i] = String.fromCharCode(uInt8Array[i]);
            }
            var data = binaryString.join('');
            var base64 = window.btoa(data);
            var dir = csInterface.getSystemPath(SystemPath.EXTENSION) + '/downloads/';
            var downloadedFile = dir + filename + ".mp4"; // TODO - get correct format from API;
            window.cep.fs.writeFile(downloadedFile, base64, window.cep.encoding.Base64);

            var sequencePresetPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/presets/KalturaCreatorSequence.sqpreset';
            csInterface.evalScript("app.project.importFiles(['"+downloadedFile+"'])", function(result) {
                csInterface.evalScript("setClipOnTrack('" + downloadedFile + "', '" + sequencePresetPath + "')");
            })
        }
    };
    xhr.send();
}

function upload() {

    // create a new upload token
    $.post("https://www.kaltura.com/api_v3/service/uploadtoken/action/add", {
        format: 1,
        ks: ks
    }, function (token) {
        uploadTokenId = token.id;
        continueUpload();
    });

    // create a new entry
    $.post( "https://www.kaltura.com/api_v3/service/media/action/add", {
        format: 1,
        ks: ks,
        entry: {
            mediaType: 1,
            name: "test2",
            objectType: "KalturaMediaEntry"
        }
    }, function( entry ) {
        entryId = entry.id;
        continueUpload();
    });
}
// continue upload
function continueUpload(){
    if (uploadTokenId.length > 0 && entryId.length > 0){
        // read file
        var dir = csInterface.getSystemPath(SystemPath.EXTENSION) + '/downloads/';
        var uploadFile =dir + 'small.mp4';
        result = window.cep.fs.readFile(uploadFile, window.cep.encoding.Base64);
        var base64Data = result.data;

        // create formData
        var formData = new FormData();
        formData.append("Filename", "small.mp4");
        formData.append("fileData", b64toBlob(base64Data, "video/mp4"));

        // upload file
        var url = "https://www.kaltura.com/api_v3/service/uploadtoken/action/upload?ks="+ks+"&format=1&uploadTokenId="+uploadTokenId+"&resumeAt=0&finalChunk=true&resume=false";
        $.ajax({
            url : url,
            type: 'POST',
            dataType: 'json',
            data: formData,
            cache : false,
            processData: false,
            contentType: false
        }).done(function(response) {
            updateEntry();
        });

    }
}

function updateEntry(){
    // update entry
    $.post("https://www.kaltura.com/api_v3/service/media/action/updateContent", {
        format: 1,
        ks: ks,
        entryId: entryId,
        resource:{
            objectType: "KalturaAssetsParamsResourceContainers",
            resources: [
                {
                    assetParamsId: 0,
                    objectType: "KalturaAssetParamsResourceContainer",
                    resource: {
                        objectType: "KalturaUploadedFileTokenResource",
                        token: uploadTokenId
                    }
                }
            ]
        }
    }, function (result) {
        alert(JSON.stringify(result));
    });
}

function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    var byteCharacters = atob(b64Data);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);

        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
}

function exportClip() {
    var outputPresetPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/presets/Match_Source_H264.epr';
    var outputPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/export';
    csInterface.evalScript("exportMedia('" + outputPresetPath + "', '" + outputPath + "', '"+ filename + "')");
}