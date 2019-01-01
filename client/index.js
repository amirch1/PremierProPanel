var csInterface = new CSInterface();
var ks = '';
var uploadTokenId = '';
var entryId = '';

$('#login-button').on('click', login);
$('#download-button').on('click', download);
$('#close-edit-button').on('click', closeEdit);
$('#upload-button').on('click', upload);
$('#export-button').on('click', exportClip);
$('#uploadCurrentEntry').on('click', function(){
    if ($('input[type=radio][name=update]:checked').val() === "create" && $('#updateEntryName').val().length === 0){
        alert("Please Enter an Entry Name.");
    } else {
        $('#update').hide();
        $('#editEntry').hide();
        $('#uploading').show();
        setTimeout(()=>{
            exportClip();
            upload();
        }, 200);
    }
});
$('#updateOpenEntry').on('click', function(){
    $('#update').show();
});
$('#cancel-edit-button').on('click', function(){
    $('#update').hide();
});
$('#upload-done-button').on('click', function(){
    $('#uploading').hide();
    $('#entriesList').show();
});

initApp();

function initApp(){
    // check if "download" and "export" folders exist and create them if not
    const extensionBasePAth = csInterface.getSystemPath(SystemPath.EXTENSION);
    if (!pathExists(extensionBasePAth + '/downloads/')){
        createFolder(extensionBasePAth + '/downloads');
    }
    if (!pathExists(extensionBasePAth + '/export/')){
        createFolder(extensionBasePAth + '/export');
    }
    $('#loader').click(function( event ) {
        event.stopImmediatePropagation();
        event.preventDefault();
    });
    $("#search").on('keyup', function (e) {
      if($("#search").val()){
        $(".search-close-button").show();
      }
        if (e.keyCode == 13) {
            listEntries();
        }
    });
    $(".search-close-button").click( function (e) {
      clearSearch();
    }).hide();

    $('input[type=radio][name=update]').change(function() {
        if (this.value == 'overwrite') {
            $('#updateEntryName').addClass("disabled");
        }
        else if (this.value == 'create') {
            $('#updateEntryName').removeClass("disabled");
        }
    });
}

function clearSearch(){
  $("#search").val("");
  $(".search-close-button").hide();
  listEntries();
}

function login(){
  $('#login-button').addClass("disabled");
  const user = $('#user').val();
  const pass = $('#pass').val();
  $.post( "https://www.kaltura.com/api_v3/service/user/action/loginByLoginId", {
      format: 1,
      loginId: user,
      password: pass
  }, function( data ) {
      if (data.message){
          alert(data.message); // login error
          $('#login-button').removeClass("disabled");
      } else {
          $('#login-button').removeClass("disabled");
          $("#login").hide();
          $("#header").show();
          $(".statusContainer").show();
          $("#entriesList").show();
          ks = data;
          listEntries();
      }
  });
}


function listEntries(){
    setStatus("Loading Entries..."); // set status
    var search = $("#search").val();
    $("ul").empty();
    $.post( "https://www.kaltura.com/api_v3/service/baseentry/action/list", {
        format: 1,
        ks: ks,
        filter: {
            typeEqual: 1,
            nameMultiLikeOr: search.length ? search  : ''
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
           $("#entries").append('<li><img src="'+entry.thumbnailUrl+'"/><span class="entryName">'+entry.name+'</span><button onclick="download(\''+entry.downloadUrl+'\',\''+entry.name+'\',\''+entry.id+'\',\''+entry.thumbnailUrl+'\')">Edit</button></li>');
        }
        resetStatus();
    });
}

function download(src, name, entryId, thumbnailUrl){
    // update UI
    setStatus("Downloading Entry...");
    $("#entriesList").hide();
    $("#editEntry").show();
    $("#entryThumbnail").attr('src',thumbnailUrl+"/width/280");

    $.post( "https://www.kaltura.com/api_v3/service/baseentry/action/get", {
        format: 1,
        ks: ks,
        entryId: entryId
    }, function( entry ) {
        $("#entryId").text(entryId);
        $("#entryName").text(name);
        $("#entryCreator").text(entry.creatorId);
        $("#entryCreated").text(new Date(entry.createdAt * 1000).toString().substr(0,24));
        $("#entryUpdated").text(new Date(entry.updatedAt * 1000).toString().substr(0,24));
    });

    $.post( "https://www.kaltura.com/api_v3/service/metadata_metadata/action/list", {
        format: 1,
        ks: ks,
        filter: {
            objectIdEqual: entryId
        }
    }, function( response ) {
        if (response.objects.length){
            const metadata = response.objects[0].xml;
            const message = metadata.substring(metadata.indexOf('<Comments>')+10, metadata.indexOf('</Comments'));
            $('#task').text(message);
        }
    });


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

            // we need to get the source type for the downloaded file using another call to Kaltura PI. Saving the file and importing to Premier can be done only after getting the source type.
            $.post( "https://www.kaltura.com/api_v3/service/flavorasset/action/getByEntryId", {
                format: 1,
                ks: ks,
                entryId: entryId
            }, function( flavours ) {
                var format = "mp4";
                for (var i=0; i<flavours.length; i++){
                    var flavor = flavours[i];
                    if (flavor.isOriginal == 1){
                        format = flavor.fileExt;
                        break;
                    }
                }
                var dir = csInterface.getSystemPath(SystemPath.EXTENSION) + '/downloads/';
                var downloadedFile = dir + name + "." + format;
                window.cep.fs.writeFile(downloadedFile, base64, window.cep.encoding.Base64);

                // use a preset for creating a new sequence to prevent a user dialogue opening for sequence settings
                var sequencePresetPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/presets/KalturaCreatorSequence.sqpreset';

                // import the downloaded file to the project, create a new sequence and put it in the sequence
                csInterface.evalScript("app.project.importFiles(['"+downloadedFile+"'])", function(result) {
                    csInterface.evalScript("setClipOnTrack('" + downloadedFile + "', '" + sequencePresetPath + "')");
                    resetStatus();
                });
            });
        }
    };
    xhr.send();
}

function closeEdit(){
    csInterface.evalScript("closeActiveSequence()");
    $("#editEntry").hide();
    $("#entriesList").show();
    $("ul").scrollTop(0);
}

function upload() {
    setStatus("Uploading to Kaltura...")
    // create a new upload token
    $.post("https://www.kaltura.com/api_v3/service/uploadtoken/action/add", {
        format: 1,
        ks: ks
    }, function (token) {
        uploadTokenId = token.id;
        continueUpload();
    });

    if ($('input[type=radio][name=update]:checked').val() === "create"){
        // create a new entry
        $.post( "https://www.kaltura.com/api_v3/service/media/action/add", {
            format: 1,
            ks: ks,
            entry: {
                mediaType: 1,
                name: $('#updateEntryName').val(),
                objectType: "KalturaMediaEntry"
            }
        }, function( entry ) {
            entryId = entry.id;
            continueUpload();
        });
    }
}
// continue upload
function continueUpload(){
    if (uploadTokenId.length > 0 && entryId.length > 0){
        // read file
        var dir = csInterface.getSystemPath(SystemPath.EXTENSION) + '/export/';
        var uploadFile =dir + 'temp.mp4';
        result = window.cep.fs.readFile(uploadFile, window.cep.encoding.Base64);
        var base64Data = result.data;

        // create formData
        var formData = new FormData();
        formData.append("Filename", "temp.mp4");
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
        $('#uploadButtonLabel').text("Done");
        $('#upload-done-button').removeClass("disabled");
        resetStatus();
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
    setStatus("Rendering Media...");
    var outputPresetPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/presets/Kaltura.epr';
    var outputPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/export';
    csInterface.evalScript("exportMedia('" + outputPresetPath + "', '" + outputPath + "', '"+ "temp" + "')");
    resetStatus();
}

/* utils */
function pathExists(path)
{
    return window.cep.fs.stat(path).err != window.cep.fs.ERR_NOT_FOUND;
}
function createFolder(path)
{
    const res = window.cep.fs.makedir(path);
}
function setStatus(status){
    $('#status').text(status);
}
function resetStatus(status){
    $('#status').text('Idle');
}