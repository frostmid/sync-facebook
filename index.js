var	_ = require ('lodash'),
	SocketIO = require ('socket.io-client'),
	Slave = require ('fos-sync-slave'),
	Facebook = require ('./libs/facebook');


var parse = {
	'status': function (entry) {
		return {
			'url': 'https://graph.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea0323',
			'author': 'https://graph.facebook.com/' + entry.from.id,
			'title': entry.story || entry.message,
			'content': entry.description || entry.message || null,
			'created_time': (new Date (entry.created_time)).getTime (),
			'metrics': {
				'comments': entry.comments ? entry.comments.count : 0,
				'likes': entry.likes ? entry.likes.count: 0
			}
		};
	},

	'link': function (entry) {
		return {
			'url': 'https://graph.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/2e63d22f3d4d9c2c1ab11ffc3481d853',
			'author': 'https://graph.facebook.com/' + entry.from.id,
			'title': entry.story,
			'content': entry.description || null,
			'created_time': (new Date (entry.created_time)).getTime (),
			'metrics': {
				'comments': entry.comments ? entry.comments.count : 0,
				'likes': entry.likes ? entry.likes.count: 0
			}
		};
	},

	'user': function (entry) {
		return {
			'url': 'https://graph.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1e9c2a8',
			'first-name': entry.first_name,
			'family-name': entry.last_name,
			'email': entry.email,
			'avatar': entry.picture ? entry.picture.data.url : null,
			'created_time': (new Date (entry.created_time)).getTime ()
		};
	},

	'thread': function (entry) {
		var members = _.pluck (entry.to.data, 'name').join (', ');

		return {
			'url': 'https://graph.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea304d',
			'title': 'Диалог ' + members,
			'created_time': (new Date (entry.created_time)).getTime ()
		};
	},

	'message': function (entry) {
		return {
			'url': 'https://graph.facebook.com/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea7f50',
			'content': entry.message,
			'author': entry.from ? ('https://graph.facebook.com/' + entry.from.id) : null,
			'created_time': (new Date (entry.created_time)).getTime ()
		};
	}
};

function facebook (slave, task) {
	return new Facebook ({
		accessToken: task._prefetch.token.access_token,
		emit: slave.emitter (task),
		parse: parse
	})
}

var url = 'http://89.179.119.16:8001';
// var url = 'http://127.0.0.1:8001';

(new Slave ({
	title: 'facebook api',
	version: '0.0.1'
}))
	.use ('urn:fos:sync:feature/56579b9770f849d75163103de23fc197', function (task) {
		return facebook (this, task).getUserPosts (task ['facebook-id']);
	})

	.use ('urn:fos:sync:feature/04c8d61b0ab10abd2b425c7cf6ff7446', function (task) {
		return facebook (this, task).getUserProfile (task ['facebook-id']);
	})

	.use ('urn:fos:sync:feature/04c8d61b0ab10abd2b425c7cf6fea33a', function (task) {
		return facebook (this, task).getUserInbox (task ['facebook-id']);
	})

	.use ('urn:fos:sync:feature/d4d529f0453ae4e85dd99513101c419a', function (task) {
		return facebook (this, task).postUserStatus (task ['message']);
	})

	.use ('urn:fos:sync:feature/d4d529f0453ae4e85dd99513101edd38', function (task) {
		return facebook (this, task).getUserStatuses (task ['facebook-id']);
	})

	.use ('urn:fos:sync:feature/2e63d22f3d4d9c2c1ab11ffc3486634a', function (task) {
		return facebook (this, task).getGraphNode (task ['url']);
	})

	// TODO: Implement explain

	.fail (function (error) {
		console.error ('Error', error);

		var reconnect = _.bind (function () {
			this.connect (SocketIO, url)
		}, this);
		
		_.delay (reconnect, 1000);
	})

	.connect (SocketIO, url);

