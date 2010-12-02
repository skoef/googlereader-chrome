/*!
Copyright (c) 2010 Reinier Schoof

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE 


GRChecker.Settings:
	Wrapper for getting and setting user defined options
*/
var GRChecker = GRChecker || {};
GRChecker.Settings = {};
// settings namespace
const GR_SETTINGS = '__settings';

// define which settings are available
GRChecker.Settings.all = {
	'use_https': true, 
	'show_notifications': false,
	'poll_interval': 60
};

// get key from settings
GRChecker.Settings.get = function(key){
	var storage = new LocalStorage(),
		settings = storage.get(GR_SETTINGS);
	if (settings && settings[key] !== undefined){
		return settings[key];
	}
	
	return GRChecker.Settings.all[key];
};

// set all settings at once
GRChecker.Settings.set = function(settings){
	var storage = new LocalStorage();
	return storage.set(GR_SETTINGS, settings);
};

// when opening options screen
// make options represent settings
GRChecker.Settings.restore = function(){
	Object.keys(GRChecker.Settings.all).each(function(field){
		var value = GRChecker.Settings.get(field);
		if (value === undefined){
			value = GRChecker.Settings.all[field];
		}
		
		if (!$(field)){
			console.log('could not restore', field, ',field not found');
			return;
		}
		
		switch (typeOf(value)){
			case 'boolean':
				$(field).set('checked', value);
				break;
				
			case 'number':
				$(field).set('value', value);
				break;
				
			default:
				console.log(typeOf(value));
		}
	});
};

// when submitting form in options screen
// save all options
GRChecker.Settings.store = function(){
	var settings = {};
	Object.keys(GRChecker.Settings.all).each(function(field){
		if (!$(field)){
			return;
		}
		
		switch ($(field).get('type')){
			case 'checkbox':
				settings[field] = $(field).get('checked');
				break;
				
			case 'number':
				settings[field] = parseInt($(field).get('value'), 10);
				break;
				
			default:
				console.log($(field));
		}
		
		
	});
	GRChecker.Settings.set(settings);
};

// backwords compatibility
// when old type settings detected, 
// convert to new type and remove old settings
if (localStorage['use_https']){
	var settings = {},
		storage = new LocalStorage();
	Object.keys(GRChecker.Settings.all).each(function(field){
		if (localStorage[field] === undefined){
			return;
		}
		
		settings[field] = (localStorage[field] === "true");
		delete localStorage[field];
	});
	GRChecker.Settings.set(settings);
}