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
			var HEIGHT = 240;
			canvas.width = WIDTH;
			canvas.height = HEIGHT;
			var rafId;
			var drawContext = canvas.getContext('2d');


			this.init = async function(){
				$('#osccount').change(function() {
					oscCount = $(this).val();
				});
				synthesizer.output.connect(context.destination);
				synthesizer.setVolume(0);
				const stream = await Microphone.init();
				const output = context.createMediaStreamSource(stream)
				let rec = new Recorder(output,{ workerPath: 'scripts/vendor/recorderWorker.js' });
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
						synthesizer.stop()
						$(this).html(PLAY_SOUND);
						rec = new Recorder(output,{workerPath:'scripts/vendor/recorderWorker.js'});
						rec.record();
					}
					recording = !recording;
				});
				synthesizer.play();
			};
			this.visualize = function() {
				drawContext.clearRect(0, 0, WIDTH, HEIGHT);
				const dataArray = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(dataArray);
				var x = 10;
				getHighestFrequencies(dataArray, oscCount)
					.forEach(function(item, index) {
						const frequency = item.index * context.sampleRate / analyser.fftSize;
						const gain = item.value / 255;
						const barWidth = (WIDTH / oscCount);
						const barHeight = item.value;
						synthesizer.setOscillatorFrequency(frequency, index);
						synthesizer.setOscillatorGain(gain, index);
						drawContext.fillStyle = '#1887d4';
						drawContext.fillRect(x, canvas.height - barHeight / 2 - 100, barWidth, barHeight);
						x += barWidth + 1;
					});
				rafId = requestAnimationFrame(self.visualize.bind(self));

			};

			var playbackFromSource = function(buffers){
				if (!buffers[0].length) return
				var source = context.createBufferSource();
				source.buffer = context.createBuffer(1, buffers[0].length, context.sampleRate);
				source.buffer.getChannelData(0).set(buffers[0]);
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
				$('.recordings-wrapper').css('display','block');
				var listElement = document.createElement('li'); 
				listElement.setAttribute('data-id',recordBin.length);
				listElement.innerHTML = 'RECORDING '+recordBin.length;
				$('.js-playback-links').append(listElement);
				listElement.addEventListener('click', function() {
					var sourceElement = recordBin[listElement.getAttribute('data-id') - 1];
					playbackFromSource(sourceElement.buffers);
				});

			};

			var getHighestFrequencies = function(Arr, maxValuesCount) {
				return Array.from(Arr)
					.map((value, index) => ({ value: value, index: index }))
					.sort((a,b) => b.value - a.value)
					.filter((a, index)  => index < maxValuesCount && a.value !== 0)
			};
		};
		return App;
	});