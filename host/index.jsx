function openDocument(){
  var fileRef = new File("~/Downloads/video.mov");
  var docRef = app.quit();
}

function setClipOnTrack(fileName, sequencePresetPath){
  fileName = fileName.substr(fileName.lastIndexOf("/")+1);
  // add a new empty sequence from preset to prevent user settings dialogue
  app.enableQE();
  qe.project.newSequence("kalturaCreatorSeq01", sequencePresetPath);
  // add clip to new sequence video track
  var track = app.project.activeSequence.videoTracks[0];
  for (var i = 0; i < app.project.rootItem.children.numItems; i++){
      if (app.project.rootItem.children[i]["name"] == fileName){
        track.insertClip(app.project.rootItem.children[i], 0);
        break;
      }
  }
}

function exportMedia(outputPresetPath, outputPath, filename){
    app.enableQE();
    var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
    if (activeSequence) {
        var projPath	= new File(app.project.path);

        if ((outputPath) && projPath.exists){
            var outPreset		= new File(outputPresetPath);
            if (outPreset.exists === true){
                var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
                if (outputFormatExtension){
                    var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

                    var fullPathToFile	= 	outputPath 	+
                        "/" 	+
                        filename +
                        "." +
                        outputFormatExtension;

                    var outFileTest = new File(fullPathToFile);

                    if (outFileTest.exists){
                        // overwrite if exist withour verification=
                        outFileTest.remove();
                        outFileTest.close();
                    }

                    var seq = app.project.activeSequence;

                    if (seq) {
                        seq.exportAsMediaDirect(fullPathToFile,
                                                outPreset.fsName,
                                                app.encoder.ENCODE_WORKAREA);
                        // Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
                        // var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
                    }
                    // alert("done");
                }
            } else {
                alert("Could not find output preset.");
            }
        } else {
            alert("Could not find/create output path.");
        }
        projPath.close();
    }
}

function closeActiveSequence(){
    var seq = app.project.activeSequence;

    if (seq) {
        seq.close();
    }
}
