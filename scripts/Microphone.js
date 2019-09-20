'use strict';   
define([], function(){
		navigator.getUserMedia  = navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia;
		return {
		init : async function() {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
			return stream;
		}
	}
	});