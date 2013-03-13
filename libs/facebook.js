var	_ = require ('lodash'),
	Q = require ('q'),
	request = require ('fos-request');


module.exports = function Facebook (settings) {
	this.settings = _.extend ({}, this.settings, settings);
	this.entry = _.bind (this.entry, this);
};

_.extend (module.exports.prototype, {
	settings: {
		base: 'https://graph.facebook.com',
		locale: 'ru_RU',
		accessToken: null,
		emit: null
	},

	request: function (url) {
		return request (url)
			.then (JSON.parse);
	},

	get: function (endpoint) {
		var url = this._appendToken (this.settings.base + endpoint);
		return this.request (url);
	},

	post: function (endpoint, data) {
		var url = this._appendToken (this.settings.base + endpoint);
		return this.request ({
			url: url,
			method: 'post',
			form: data
		});	
	},

	list: function (endpoint, iterator) {
		var fetchMore = _.bind (function (url) {
			return this.request (url)
				.then (process);
		}, this);

		var process = function (results) {
			var promises = [];

			if (results.error) {
				throw results.error;
			}

			if (results.data) {
				promises = _.map (results.data, iterator);
			}

			if (results.paging) {
				// TODO: Uncomment that (disabled to reduce limits usage while developing)
				promises.push (
					fetchMore (results.paging.next)
				);
			}

			return Q.all (promises);
		};

		return this.get (endpoint)
			.then (process);
	},

	entry: function (entry, type) {
		var type = typeof type == 'string' ? type : entry.type || (entry.metadata ? entry.metadata.type : null),
			parser = this.settings.parse [type],
			parsed;

		if (typeof parser == 'function') {
			try {
				parsed = parser.call (this, entry);
			} catch (e) {
				console.error ('Failed to parse entry', e.message, entry);
				throw e;
			}
			

			Q.when (parsed)
				.then (this.settings.emit)
				.fail (function (error) {
					console.log ('Failed to emit entry', error, entry);
				})
				.done ();
		} else {
			console.log ('Skipping', entry.id, 'of unkown type', type);
		}
	},

	_appendToken: function (url) {
		var q = (url.indexOf ('?') === -1) ? '?' : '&';

		return url + q +
			'access_token=' + this.settings.accessToken +
			'&locale=' + this.settings.locale +
			'&metadata=true';
	},

	getUserPosts: function (userId) {
		userId = userId || 'me';
		return this.list ('/' + userId + '/posts', this.entry);
	},

	getUserProfile: function (userId) {
		userId = userId || 'me';

		return this.get ('/' + userId + '?fields=id,first_name,last_name,picture,email')
			.then (this.entry);
	},

	getUserInbox: function (userId) {
		userId = userId || 'me';

		var once = false;

		// get threads
		return this.list ('/' + userId + '/inbox', _.bind (function (entry) {
			// if (once) return else once = true
			this.entry (entry, 'thread');

			// get messages in thread
			return this.list ('/' + entry.id + '/comments', _.bind (function (entry) {
				this.entry (entry, 'message');
			}, this));
		}, this));
	},

	getUserStatuses: function (userId) {
		userId = userId || 'me';

		return this.list ('/' + userId + '/statuses', _.bind (function (entry) {
			this.entry (entry, 'status');
		}, this));
	},

	postUserStatus: function (message, userId) {
		userId = userId || 'me';

		return this.post ('/' + userId + '/feed', {
			message: message
		});

		// return this.post ('/114444035404042/comments', {
		// 	message: message
		// })
		// 	.then (console.log)
		// 	.fail (console.error);

		// console.log ('post status', message);
	}
});

