require.config({
	baseUrl: 'scripts',
	shim: {	
		'lightbox':['jquery']
	},
	paths: {
		'jquery':'jquery',
	}
});

require([
	'App',
	], function( App) {
		'use strict';
		var app = new App();
		app.init();
	});