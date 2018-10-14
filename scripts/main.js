require.config({
	baseUrl: 'scripts',
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