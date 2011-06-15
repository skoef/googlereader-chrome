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


GRChecker:
	Base class for Google Reader Chrome extension
*/
var GRChecker = new Class({
	
	initialize: function(){
		// init vars
		this.currentWindow = false;
		
		// initially, mark session logged out
		this.setSessionLoggedIn(false);
		
		// bind extension events for:
		// - when user clicks icon
		chrome.browserAction.onClicked.addListener(this.handleClicked.bind(this));
		// - when user switches tabs
		chrome.tabs.onSelectionChanged.addListener(this.handleTabSelectionChanged.bind(this));
		// - when user updates a tab
		chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
		
		// start polling
		this.fetchUnreadCount();
		console.log('init done');
	},
	
	// mark session either logged in or logged out
	// and change icon color
	setSessionLoggedIn: function(bLoggedIn){
		console.log('session', bLoggedIn);
		if (bLoggedIn !== true){
			// change icon to the grey version
			chrome.browserAction.setIcon({
				path: "images/logo_128_grey.png"
			});
			// show login text
			chrome.browserAction.setTitle({
				title: 'Google Reader: ' + chrome.i18n.getMessage('clickToLogin')
			});
			// hide badge
			this.setBadge(0);
		} else {
			// change icon to the blue version
			chrome.browserAction.setIcon({
				path: "images/logo_16.png"
			});
			// remove login text when previously not logged in
			if (this.sessionLoggedIn !== true){
				chrome.browserAction.setTitle({
					title: 'Google Reader'
				});
			}
		}
		
		this.sessionLoggedIn = bLoggedIn;
	},
	
	// set number of unread items in icon badge
	// when unread items is 0, no badge is shown
	// also update icon title
	setBadge: function(count){
		console.log('set badge', count);
		// init empty badge
		var text = '',
			title = 'Google Reader';
		if (count >= 1){
			// add current count to badge text when there are any unread items
			text += count;
			title += ': ' + count + ' ' + (count === 1 ? chrome.i18n.getMessage('totalUnreadOne') : chrome.i18n.getMessage('totalUnread'));
		}
		
		// set badge color
		chrome.browserAction.setBadgeBackgroundColor({
			color:[12, 49, 187, 180]
		});
		// set badge text
		chrome.browserAction.setBadgeText({
			text: text
		});
		// set icon title
		chrome.browserAction.setTitle({
			title: title
		});
	},
	
	// handle icon clicked event
	handleClicked: function(){
		console.log('user clicked', arguments);
		// extension is clicked,
		// take user to Google Reader
		var https = GRChecker.Settings.get('use_https'),
			new_url = (!https || https === true ? 'https' : 'http') + '://www.google.com/reader/';
		
		// check if any GR window is already open
		// if so, switch to that tab and reload it
		// otherwise open new tab 
		// or use an open 'newtab' window when available
		chrome.tabs.getAllInWindow(undefined, function(tabs){
			var valid_tabs = tabs.filter(function(tab){
				return !(typeOf(tab.url) === false || tab.url.match(/^(http|https):\/\/www\.google\.com\/reader\//) === null && tab.url !== 'chrome://newtab/');
			});
			
			// first found tab will do
			// reload tab and switch to it
			if (valid_tabs.length > 0){
				chrome.tabs.update(valid_tabs[0].id, {
					selected: true,
					url: new_url
				});
				console.log('mekker');
				return;
			}
			
			// otherwise open new tab and navigate to Google Reader
			chrome.tabs.create({url: new_url});
		});
	},
	
	// handle tab selection changed event
	// when user moves to or away from GR screen
	// sync unread count
	handleTabSelectionChanged: function(tabID){
		chrome.tabs.get(tabID, function(tab){
			this.checkTabForGoogleReader(tab);
		}.bind(this));
	},
	
	// handle tab updated event
	// when the user navigates to GR
	// sync unread count
	handleTabUpdated: function(tab){
		this.checkTabForGoogleReader(tab);
	},
	
	// check tab for having GR
	checkTabForGoogleReader: function(tab){
		// hmm, no url?
		if (typeOf(tab.url) === false){
			return;
		}
		
		var match;
		try {
			match = tab.url.match(/^(http|https):\/\/www\.google\.com\/reader\//);
			// url does not match and current window is not Google Reader either
			if (match === null && this.currentWindow === false){
				return;
			}
		} catch(x){
			return;
		}
		
		// are we on Google Reader right now?
		// useful for checking whether we're navigating away from GR
		this.currentWindow = (match !== null);
		// refresh unread count
		this.fetchUnreadCount();
	},
	
	// request unread count from GR
	fetchUnreadCount: function(){
		// determine to use http or https
		var https = GRChecker.Settings.get('use_https'),
			url = (!https || https === true ? 'https' : 'http') + '://www.google.com/reader/api/0/unread-count?output=json';
		
		// when already requesting,
		// cancel that attempt
		try {
			this.xhr.cancel();
		} catch (x){}
		
		// init request
		this.xhr = new Request.JSON({
			'url': url,
			'method': 'GET',
			'async': true,
			// bind response handler
			'onSuccess': this.handleResponse.bind(this),
			// when attempt fails
			// mark session as logged out
			'onFailure': function(){
				console.log('failed, logging out');
				this.setSessionLoggedIn(false);
				// try again after timeout
				this.scheduleNext();
			}.bind(this)
		});
		// send request
		this.xhr.send();
	},
	
	// handle response from AJAX request
	handleResponse: function(response){
		// invalid response
		// reason unknown, but mark session offline
		if (!response || typeOf(response.unreadcounts) === false){
			console.log('invalid response, try again later');
			this.setSessionLoggedIn(false);
			// try again after timeout
			this.scheduleNext();
			return;
		}
		
		// temporarily permission is denied
		// don't move a muscle, 
		// but do schedule next request attempt
		if (response.denied){
			console.log('permission is denied');
			this.scheduleNext();
			return;
		}
		
		// mark session logged in
		this.setSessionLoggedIn(true);
		
		// init vars
		var count = 0,
			label = GRChecker.Settings.get('label'),
			pattern,
			newCount,
			notification,
			notify;
		if (label == '') {
			pattern = 'com.google\/reading-list$';
		} else {
			pattern = 'label\/' + label + '$';
		}
		var re = new RegExp(pattern);

		// count unread items
		response.unreadcounts.each(function(feed, index){
			if (typeOf(feed.id) !== false && feed.id.match(re) !== null){
				console.log(feed.count, 'unread items by', feed.id);
				count += feed.count;
			}
		});
		console.log('total unread', count);
		
		// notify user, when enabled and new count is higher than current count
		if (this.unreadCount !== undefined && this.unreadCount < count){
			console.log('show notify', this.unreadCount, count);
			newCount = (count - this.unreadCount);
			notify = GRChecker.Settings.get('show_notifications');
			// check for desire to show notice and ask webkit for permission
			if (newCount > 0 && notify === true && webkitNotifications.checkPermission() === 0){
				try {
					// format notice
					// show the number of new unread items
					notification = webkitNotifications.createNotification(
						'images/logo_48.png',
						'Google Reader',
						newCount + ' ' + (newCount === 1 ? chrome.i18n.getMessage('noticeUnreadOne') : chrome.i18n.getMessage('noticeUnreadOne')) + ' ' + chrome.i18n.getMessage('noticeSuffix')
					);
					// make notification disappear automatically
					// after 5 secs
					notification.ondisplay = function(){
						var not = this;
						setTimeout(function(){
							not.cancel();
						}, 5000);
					};
					// show notice
					notification.show();
				} catch (x){}
			}
		} else {
			console.log('no notice needed', this.unreadCount, count);
		}
		
		// record current unread item count
		this.unreadCount = count;
		
		// set count
		this.setBadge(count);
		
		// schedule next request
		this.scheduleNext();
		console.log('handle done');
	},
	
	// schedule next request
	scheduleNext: function(){
		// clear concurrent scheduled polls
		if (this.scheduledPoll){
			console.log('clearing previous scheduled poll', this.scheduledPoll);
			clearTimeout(this.scheduledPoll);
		}
		
		var pollinterval = (GRChecker.Settings.get('poll_interval') * 1000);
		// schedule new fetch
		console.log('next check in', pollinterval, 'ms');
		this.scheduledPoll = this.fetchUnreadCount.bind(this).delay(pollinterval);
	}
});
