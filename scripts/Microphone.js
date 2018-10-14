'use strict';   
define([], function(){
		navigator.getUserMedia  = navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia;
		var Microphone = {}
		Microphone.init = async function(args) {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
			var output = args.context.createMediaStreamSource(stream);
			args.userPermissionGranted(output);
		};
		return Microphone;
	});