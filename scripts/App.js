define([
	'jquery',
	'Synthesizer',
	'Microphone',
	'vendor/recorder',
	], function($, Synthesizer, Microphone){
		'use strict';
		var App = function(){
			var context;
			if(window.AudioContext){
				context =new window.AudioContext();
			}else if(window.webkitAudioContext){
				context = new window.webkitAudioContext(); 
			}
			var self = this;
			var canvas = document.querySelector('canvas');
			var analyser = context.createAnalyser();
			var synthesizer = new Synthesizer({context:context});
			var recording  = false;
			var animating;
			var oscCount = 1;
			var recordBin=[];
			var PLAY_SOUND='PLAY';
			var RECORD_SOUND ='RECORD';
			var WIDTH =800;
			var HEIGHT = 440;
			var drawContext = canvas.getContext('2d');


			this.init=function(){
				$('#osccount').change(function() {
					oscCount = $(this).val();
				});
				synthesizer.output.connect(context.destination);
				synthesizer.setVolume(0);
				Microphone.init({context:context,userPermissionGranted:function(output){
					var rec = new Recorder(output,{workerPath:'scripts/vendor/recorderWorker.js'});
					$('.js-record-button').click(function(event) {
						event.preventDefault();
						if(recording){
							$(this).html(RECORD_SOUND);
							rec.stop();
							rec.getBuffer(function (buffers) {
								recordBin.push({buffers:buffers});
								playbackFromSource(buffers);
								createPlaybackLink();
							});
						}else{
							for(var i = 0;i<=oscCount;i++){
								synthesizer.setOscillatorGain(0,i);
							}
							$(this).html(PLAY_SOUND);
							rec = new Recorder(output,{workerPath:'scripts/vendor/recorderWorker.js'});
							rec.record();
							window.cancelAnimationFrame(animating);
							animating =null;
						}
						recording =!recording;
					});
				}
			});
				synthesizer.play();

			};
			this.visualize = function() {
				canvas.width = WIDTH;
				canvas.height =HEIGHT;
				drawContext.clearRect(0, 0, WIDTH, HEIGHT);
				var bufferLength = analyser.frequencyBinCount;
				var dataArray = new Uint8Array(bufferLength);
				analyser.getByteFrequencyData(dataArray);
				var barWidth = (WIDTH / oscCount);
				var barHeight;
				var highestFrequencies;
				var x =10;
				drawContext.font = '20px serif';

				if(!recording){
					highestFrequencies= getHighestFrequencies(dataArray,oscCount);
				}
				$.each(highestFrequencies, function(index) {
					var frequency = this.index*context.sampleRate/analyser.fftSize;
					var gain = this.value/255;
					barHeight = this.value;
					synthesizer.setOscillatorFrequency(frequency,index);
					synthesizer.setOscillatorGain(gain,index);
					drawContext.fillStyle='#1887d4';
					drawContext.fillRect(x,canvas.height-barHeight/2-100,barWidth,barHeight);
					drawContext.fillStyle='#e53529';
					drawContext.fillText(frequency.toFixed(2) ,x,canvas.height);
					x += barWidth + 1;
				});

				requestAnimationFrame(this.visualize.bind(this));
			};
			var playbackFromSource = function(buffers){
				var source = context.createBufferSource();
				source.buffer = context.createBuffer(1, buffers[0].length, 44100);
				source.buffer.getChannelData(0).set(buffers[0]);
				source.buffer.getChannelData(0).set(buffers[1]);
				source.connect(analyser);
				source.start(0);
				synthesizer.setVolume(1);
				source.onended = function() {
					synthesizer.setVolume(0);
					synthesizer.stop();
					source.stop(0);
				};
				animating = requestAnimationFrame(self.visualize.bind(self));

			};

			var createPlaybackLink = function(){
				var listElement =document.createElement('li'); 
				listElement.setAttribute('data-id',recordBin.length);
				listElement.innerHTML = 'RECORDING '+recordBin.length;
				listElement.onclick = function(){
					var sourceElement = recordBin[listElement.getAttribute('data-id')-1];
					playbackFromSource(sourceElement.buffers);
				};
				$('.js-playback-links').append(listElement);

			};
			var getHighestFrequencies = function(array, maxValuesCount){
				var maxValues = [];
				var previousValue =  {value:Number.POSITIVE_INFINITY,index:Number.NEGATIVE_INFINITY};
				maxValues[0] =previousValue;
				var highestValue=0;
				var highestIndex=0;
				for(var count = 0; count < maxValuesCount; count++) {
					var max = 	Number.NEGATIVE_INFINITY;
					for(var i = 0; i < array.length; i++) {
						if(array[i]/2>max){
							if(i!==previousValue.index&&array[i]/2<previousValue.value){
								max = array[i]/2;
								highestValue =array[i]/2;
								highestIndex = i;
							}
						}
					}
					previousValue.value = highestValue;
					previousValue.index = highestIndex;
					maxValues[count]={value:highestValue,index:highestIndex};

				}
				return maxValues;
			};
		};
		return App;
	});