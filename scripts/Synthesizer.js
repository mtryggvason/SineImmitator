'use strict';
define([
	], function(){
		var context;
		var oscillatorCount =50;
		var oscillators = [];
		var gains = [];
		var arpeggiate = function(value){
			setTimeout(function(){
				gains[value].gain.linearRampToValueAtTime(1.0, context.currentTime + 0.2);

			},500*value);
		};	
		var Synthesizer = function(args){
			context = args.context;

			this.output = context.createGain();
			for(var i = 0;i<oscillatorCount;i++){
				oscillators[i]= context.createOscillator();
				gains[i] = context.createGain();
				gains[i].gain.value=0;
				oscillators[i].connect(gains[i]);
				gains[i].connect(this.output);
			}
			this.output.gain.value = 1;

			this.play = function(){
				for(var i = 0;i<oscillatorCount;i++){
					oscillators[i].start(0);
				}
			};
			this.stop = function(){
				for(var i = 0;i<oscillatorCount;i++){
					gains[i].gain.value =0;
				}
			};

			this.setOscillatorFrequency = function(value, index){

				oscillators[index].frequency.value =value;
			};
			this.setOscillatorGain = function(value, index){
				gains[index].gain.value =value;
			};

			this.setVolume = function(value){
				this.output.gain.value = value;
			};

			this.noteDown = function(frequency, numberOfOscillators){
				frequency = Math.abs(frequency);
				this.setOscillatorFrequency(frequency);
				for(var i = 0;i<numberOfOscillators;i++){
					arpeggiate(i);
				}
			};	
			this.noteUp = function(){
				for(var i = 0;i<oscillatorCount;i++){
					gains[i].gain.linearRampToValueAtTime(0.0, context.currentTime + 0.2);

				}
			};
		};
		return Synthesizer;
	});