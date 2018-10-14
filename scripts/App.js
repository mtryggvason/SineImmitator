define([
	'jquery',
	'Synthesizer',
	'Microphone',
	'vendor/recorder',
	], function($, Synthesizer, Microphone){
		'use strict';
		var App = function(){
			var context;
			if (window.AudioContext) {
				context =new window.AudioContext();
			}else if (window.webkitAudioContext) {
				context = new window.webkitAudioContext(); 
			}
			var self = this;
			var canvas = document.querySelector('canvas');
			var analyser = context.createAnalyser();
			var synthesizer = new Synthesizer({ context: context });
			var recording  = false;
			var oscCount = 1;
			var recordBin = [];
			var PLAY_SOUND='PLAY';
			var RECORD_SOUND ='RECORD';
			var WIDTH = 400;
			var HEIGHT = 440;
			var rafId;
			var drawContext = canvas.getContext('2d');


			this.init = function(){
				$('#osccount').change(function() {
					oscCount = $(this).val();
				});
				synthesizer.output.connect(context.destination);
				synthesizer.setVolume(0);
				Microphone.init({context: context, userPermissionGranted:function(output){
					var rec = new Recorder(output,{ workerPath: 'scripts/vendor/recorderWorker.js' });
					$('.js-record-button').click(function(event) {
						event.preventDefault();
						if (recording) {
							$(this).html(RECORD_SOUND);
							rec.stop();
							rec.getBuffer(function (buffers) {
								recordBin.push({ buffers: buffers });
								playbackFromSource(buffers);
								createPlaybackLink();
							});
						} else {
							for (var i = 0;i <= oscCount; i++) {
								synthesizer.setOscillatorGain(0,i);
							}
							$(this).html(PLAY_SOUND);
							rec = new Recorder(output,{workerPath:'scripts/vendor/recorderWorker.js'});
							rec.record();
						}
						recording =!recording;
					});
				}
			});
				synthesizer.play();
			};
			this.visualize = function() {
				canvas.width = WIDTH;
				canvas.height = HEIGHT;
				drawContext.clearRect(0, 0, WIDTH, HEIGHT);
				var dataArray = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(dataArray);
				var highestFrequencies;
				var x = 10;
				drawContext.font = '20px serif';
				if (!recording) {
					highestFrequencies= getHighestFrequencies(dataArray,oscCount);
				}

				highestFrequencies.forEach(function(item, index) {
					var frequency = item.index * context.sampleRate / analyser.fftSize;
					var gain = item.value / 255;
					const barWidth = (WIDTH / oscCount);
					const barHeight = item.value;
					synthesizer.setOscillatorFrequency(frequency, index);
					synthesizer.setOscillatorGain(gain, index);
					drawContext.fillStyle = '#1887d4';
					drawContext.fillRect(x, canvas.height - barHeight / 2 - 100, barWidth, barHeight);
					drawContext.fillStyle = '#e53529';
					x += barWidth + 1;
				});
				rafId = requestAnimationFrame(self.visualize.bind(self));

			};

			var playbackFromSource = function(buffers){
				var source = context.createBufferSource();
				source.buffer = context.createBuffer(1, buffers[0].length, context.sampleRate);
				source.buffer.getChannelData(0).set(buffers[0]);
				source.buffer.getChannelData(0).set(buffers[1]);
				source.connect(analyser);
				source.start();
				synthesizer.setVolume(1);
				rafId = requestAnimationFrame(self.visualize.bind(self));
				source.onended = function() {
					cancelAnimationFrame(rafId);
					synthesizer.setVolume(0);
					synthesizer.stop();
					source.stop();
				};
			};

			var createPlaybackLink = function(){
				var listElement =document.createElement('li'); 
				listElement.setAttribute('data-id',recordBin.length);
				listElement.innerHTML = 'RECORDING '+recordBin.length;
				listElement.addEventListener('click', function() {
					var sourceElement = recordBin[listElement.getAttribute('data-id')-1];
					playbackFromSource(sourceElement.buffers);
				});
				$('.js-playback-links').append(listElement);

			};

			var getHighestFrequencies = function(Arr, maxValuesCount){
				var maxValues = [];
				var previousValue =  { value:Number.POSITIVE_INFINITY, index:Number.NEGATIVE_INFINITY };
				maxValues[0] = previousValue;
				var highestValue= 0;
				var highestIndex= 0;
				
				return Array.from(Arr)
					.map((value, index) => ({ value: value, index: index }))
					.sort((a,b) => b.value - a.value)
					.filter((a, index)  => index < maxValuesCount && a.value !== 0)
			};
		};
		return App;
	});