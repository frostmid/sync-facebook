var	_ = require ('lodash'),
	Q = require ('q'),
	Promises = require ('vow'),
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

/*
			if (results.paging) {
				// TODO: Uncomment that (disabled to reduce limits usage while developing)
				promises.push (
					fetchMore (results.paging.next)
				);
			}
			*/

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

			console.log('* emit', parsed.url);
			
			return Q.when (parsed)
				.then (this.settings.emit)
				.fail (function (error) {
					console.log ('Failed to emit entry', error, entry);
				})
				.done ();
		} else {
			console.log ('Skipping', entry.id, 'of unknown type', type);
		}
	},

	_appendToken: function (url) {
		var q = (url.indexOf ('?') === -1) ? '?' : '&';

		return url + q +
			'access_token=' + this.settings.accessToken +
			'&locale=' + this.settings.locale +
			'&metadata=true';
	},

	getComments: function (entry) {

		if(entry.comments && entry.comments.data.length)
		{
			return this.list ('/' + entry.id + '/comments', _.bind (function (result) {
				result.ancestor = result.parent ? result.parent : 'https://www.facebook.com/' + entry.id;
				this.entry (result, 'comment');
			}, this));
		} else {
			return null;
		}
	},

	getPosts: function (objectId) {
		objectId = objectId || 'me';

		return this.list ('/' + objectId + '/posts', _.bind (function (entry) {
			entry.ancestor = 'https://www.facebook.com/' + objectId;

			return Q.all ([
				this.entry (entry),
				this.getComments (entry)
			]);

		}, this));
	},

	getFeed: function (objectId) {
		return this.list ('/' + objectId + '/feed', _.bind (function (entry) {
			entry.ancestor = 'https://www.facebook.com/' + objectId;
			
			return Q.all ([
				this.entry (entry),
				this.getComments (entry)
			]);
		}, this));
	},

	getUserProfile: function (userId) {
		userId = userId || 'me';

		return this.get ('/' + userId + '?fields=id,first_name,last_name,picture,email,updated_time')
			.then (this.entry);
	},

	getUserInbox: function (userId) {
		userId = userId || 'me';

		var once = false;

		// get threads
		return this.list ('/' + userId + '/inbox', _.bind (function (entry) {
			return Q.all ([
				this.entry (entry, 'thread'),
				this.getComments (entry)
			]);
		}, this));
	},

	getUserStatuses: function (userId) {
		userId = userId || 'me';

		return this.list ('/' + userId + '/statuses', _.bind (function (entry) {
			return Q.all ([
				this.entry (entry, 'status'),
				this.getComments (entry, 'comment')
			]);
		}, this));
	},

	postUserStatus: function (message, userId) {
		userId = userId || 'me';

		return this.post ('/' + userId + '/feed', {
			message: message
		});
	},

	reply: function (objectId, message, issue) {
		var self = this,
			url;

		return self.get('/' + objectId)
			.then(function (entry) {
				var type = entry.type || (entry.metadata ? entry.metadata.type : null);

				switch (type)
				{
					//'user': url = '/' + objectId + '/'; break;
					default: url = '/' + objectId + '/comments?message=' + message;
				}

				return self.post (url).then(function (entry) {
					return self.get('/' + (entry.id || entry))
						.then(function (entry) {
							entry.ancestor = 'https://www.facebook.com/' + objectId;
							entry.issue = issue;
							self.entry (entry, 'comment');
						});
				});
			});
	},

	getGraphNode: function (id) {
		var self = this;

		if (id) {
			return this.get ('/' + id)
				.then (function (entry) {

					var getFields = function (entry) {
						var promise = Promises.promise();

						if (entry.metadata) {
							promise.fulfill (entry.metadata.fields);
						} else {
							self.get('/' + entry.id)
								.then(function (entry) {
									promise.fulfill (entry.metadata.fields);
								});
						}

						return promise;
					};

					return getFields (entry).then(function (fields) {
						var fields = _.map (
							_.filter (fields, function (field) {
								return field.name != 'payment_mobile_pricepoints';
							}),
							function (field) {
								return field.name;
							}
						).join (',');

						return self.get ('/' + id + '?fields=' + fields);
					});
				})
				.then (function (entry) {
					var type = entry.type;

					if (!type && entry.metadata) {
						type = entry.metadata.type;
					}

					self.entry (entry, type);

					if (!type) {
						console.error ('entry has no type', id, entry);
					}
				});
		}
	}
});

