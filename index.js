process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var	_ = require ('lodash'),
	Promises = require ('vow'),
	SocketIO = require ('socket.io-client'),
	Slave = require ('fos-sync-slave'),
	Facebook = require ('./libs/facebook'),
	url = process.argv [2] || 
		'http://127.0.0.1:8001'
		//'http://192.168.104.254:8001'
	;


var parse = {
	'status': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea0323',
			'author': 'https://www.facebook.com/' + entry.from.id,
			'ancestor': entry.ancestor || null,
			'title': entry.story || entry.message,
			'content': entry.description || entry.message || null,
			'created_at': (new Date (entry.created_time)).getTime () / 1000,
			'metrics': {
				'comments': entry.comments ? entry.comments.count : 0,
				'likes': entry.likes ? entry.likes.count: 0
			}
		};
	},

	'link': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/2e63d22f3d4d9c2c1ab11ffc3481d853',
			'author': 'https://www.facebook.com/' + entry.from.id,
			'ancestor': entry.ancestor || null,
			'title': entry.name,
			'content': entry.message,
			'created_at': (new Date (entry.created_time)).getTime () / 1000,
			'metrics': {
				'comments': entry.comments ? entry.comments.data.length : 0,
				'likes': entry.likes ? entry.likes.data.length: 0
			}
		};
	},

	'user': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1e9c2a8',
			'first-name': entry.first_name,
			'family-name': entry.last_name,
			'email': entry.email,
			'avatar': entry.picture ? entry.picture.data.url : null,
			'created_at': null,

			'nickname': entry.first_name
		};
	},

	'thread': function (entry) {
		var members = _.pluck (entry.to.data, 'name').join (', ');

		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea304d',
			'title': 'Диалог ' + members,
			//'created_at': (new Date (entry.updated_time)).getTime () / 1000
		};
	},

	'message': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea7f50',
			'content': entry.message,
			'ancestor': entry.ancestor || null,
			'author': entry.from ? ('https://www.facebook.com/' + entry.from.id) : null,
			'created_at': (new Date (entry.created_time)).getTime () / 1000
		};
	},

	'page': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/1f1d48152476612c3d5931cb927574a7',
			'title': entry.name,
			'avatar': entry.picture ? entry.picture.data.url : null,

			'created_at': null,
			'first-name': entry.name
		}
	},

	'group': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/1f1d48152476612c3d5931cb927574a7',
			'title': entry.name,
			'avatar': entry.picture ? entry.picture.data.url : null
		}
	},

	'comment': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/e5ce7e5ee754309096f0efe1f70d7bac',
			'author': 'https://www.facebook.com/' + entry.from.id,
			'ancestor': entry.ancestor || null,
			'title': entry.name,
			'content': entry.message,
			'created_at': (new Date (entry.created_time)).getTime () / 1000,
			'metrics': {
				'comments': entry.comment_count ? entry.comment_count : 0,
				'likes': entry.like_count ? entry.like_count: 0
			},
			'issue': entry.issue || null
		};
	},

	'photo': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/9414c18c2684a3d6dd8ae694301411dd',
			'title': entry.name,
			'content': entry.message || null,
			'ancestor': entry.ancestor || null
		}
	},

	'video': function (entry) {
		return {
			'url': 'https://www.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/9414c18c2684a3d6dd8ae69430143e6d',
			'title': entry.name,
			'content': entry.message || null,
			'ancestor': entry.ancestor || null
		}
	}
	
};

function facebook (slave, task, preEmit) {
	return new Facebook ({
		accessToken: task._prefetch.token.access_token,
		//accessToken: 'CAACEdEose0cBAGWuJiCxepzc0SAApLL67rNxwgwLWvda5I98TEhfwAXc4xz4hNhFfouMqlzpVoZAQuwZBImJoXbUvLdMmwtKWS1L6qTRpSlFCLttZCBtPyZAqQdv5lE5gZCw0CAABJL9g57JXBe9oWR8fTFPxuS404IE5wjeYUbXMtUQxO9KcVWNFDDZAX0RUZD',
		emit: function (entry) {
			if (preEmit) {
				entry = preEmit (entry);
			}
			
			return slave.emitter (task).call (this, entry);
		},
		parse: parse
	})
};

function getObjectId (url) {
	var tmp;

	if (url && (tmp = url.match(/facebook.com\/(\d+)(|\_(\d+))$/)))
	{
		return tmp [1] + (tmp [2] ? tmp [2] : '');
	}

	return url;
};

(new Slave ({
	title: 'facebook api',
	version: '0.0.1'
}))
	.use ('urn:fos:sync:feature/56579b9770f849d75163103de23fc197', function getPosts (task) {
		return facebook (this, task).getPosts (getObjectId (task.url));
	})

	.use ('urn:fos:sync:feature/04c8d61b0ab10abd2b425c7cf6ff7446', function getUserProfile (task) {
		var token = task._prefetch.token;

		var preEmit = function (entry) {
			entry.tokens = [token._id];
			return entry;
		};

		return facebook (this, task, preEmit).getUserProfile (getObjectId (task.url));
	})

	.use ('urn:fos:sync:feature/53b87e0f48f3dec304b32113b82676c6', function (task) {
		return facebook (this, task).getUserInbox (getObjectId (task.url));
	})

	.use ('urn:fos:sync:feature/d4d529f0453ae4e85dd99513101c419a', function (task) {
		return facebook (this, task).postUserStatus (task ['message']);
	})

	.use ('urn:fos:sync:feature/d4d529f0453ae4e85dd99513101edd38', function (task) {
		return facebook (this, task).getUserStatuses (getObjectId (task.url));
	})

	.use ('urn:fos:sync:feature/2bbecff23a38a658eb0d09414120d425', function (task) {
		return facebook (this, task).getFeed (getObjectId (task.url));
	})

	.use ('urn:fos:sync:feature/04c8d61b0ab10abd2b425c7cf6ff2bda', function (task) {
		return facebook (this, task).reply (getObjectId (task.url), task.content, task.issue);
	})

	.use ('urn:fos:sync:feature/c12087cdb5bee2f607e73d5c68c57dd0', function (task) {
		console.log('explain');

		return facebook (this, task).getGraphNode (getObjectId (task.url));
	})

	.fail (function (error) {
		console.error ('Error', error);

		var reconnect = _.bind (function () {
			this.connect (SocketIO, url)
		}, this);
		
		_.delay (reconnect, 1000);
	})

	.connect (SocketIO, url);

/*поиск по русски
поиск по сайтам, где комменты оставлены от fb (с лайками и прочими, сслыка где оставлен коммент)


*/