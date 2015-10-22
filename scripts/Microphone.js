  		'use strict';   
  		define([
  			'jquery',
  			], function($){
  				navigator.getUserMedia  = navigator.getUserMedia ||
  				navigator.webkitGetUserMedia ||
  				navigator.mozGetUserMedia ||
  				navigator.msGetUserMedia;
  				var Microphone = function(){

  				};
  				Microphone.init = function(args){
  					if (navigator.getUserMedia) {
  						MediaStreamTrack.getSources(function(sourceInfos) {
  							var audioSource = null;
  							for (var i = 0; i != sourceInfos.length; ++i) {
  								var sourceInfo = sourceInfos[i];
  								if (sourceInfo.kind === 'audio') {
  									audioSource = sourceInfo.id;
  								} 
  							}
  							var constraints = {
  								audio: {
  									optional: [{sourceId: audioSource}]
  								}
  							};
  							navigator.getUserMedia(constraints, function(stream) {
  								  var output = args.context.createMediaStreamSource(stream);
                    args.userPermissionGranted(output);

  							}, function(e) {
  								console.log('Reeeejected!', e);
  							});
  						});

  					}
  				};
  				return Microphone;
  			});