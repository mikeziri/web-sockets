var players_id = 0;
var nr_players = 0;
var players = [];

var port = 8080;
var net = require('net'),
	sys = require('sys'),
	ps = require('./player');
	tools = require('./tools'),
	log = tools.log,
	ws = require('./websockets'),
	crypto = require('crypto');
	
var server = net.createServer(function (socket) {
	socket.setEncoding('binary');
	socket.on('connect', connect_player);
	socket.on('data', on_data);
	socket.on('end', disconnect_player);
});
server.listen(port);
server.maxConnections = 16;
//server.connections = 16;

log('server started');
log('listening on port: ' + port);

function connect_player () {
	log('new player connecting...');
	this.id = ++players_id;
	players.push(this);
	nr_players++;
	log('new player connected id: ' + this.get_id());
}

function on_data (data) {
	if (!this.hs) { // do handshake
		if (!ws.handshake(this, data)) {
			disconnect_player(this);
		}
	}
	else {
		// process data
		process_data(this, data);
	}
}

function disconnect_player (p) {
	if (!p) {
		p = this;
	}
	log('player disconnected id: '+p.get_id());
	var index;
	if ((index = get_player_index(p)) >= 0) {
		players.splice(index, 1);
	}
	nr_players--;
	log('number of players: '+nr_players);
	if (p.name)
		send_cmd_others(p, 'disconnect', true, '');
	p.destroy();
}

function get_player_index (p) {
	for (var i in players) {
		if (players[i].id == p.id)
			return i;
	}
	return -1;
}

function check_name (name) {
	for (var i in players) {
		if (players[i].name == name)
			return false;
	}
	return true;
}

function process_data (p, data) { // receives player and data
	var id = p.get_id();
	var raw = tools.utf8.decode(ws.unwrap(data));
	log('received '+raw.length+' bytes: '+raw+' from: '+id);
	data = JSON.parse(raw);
	data.params = decodeURI(data.params);

	switch (data.cmd) {
		case 'setname' : {
			if (check_name(data.params)) {
				p.name = data.params;
				send_cmd(p, 'setname', 'ok');
				send_cmd_others(p, 'connect', true, '');
			}
			else {
				send_cmd(p, 'setname', 'error: player name already exists');
			}
			break;
		}
		case 'msg' : {
			send_cmd_others(p, 'msg', true, data.params);
			break;
		}
		case 'ping' : {
			send_cmd(p, 'pong', '');
			break;
		}
		default : {
			log('received invalid command: '+data.params);
			send_cmd(p, 'error', data.params);
		}
	}
}

function send_cmd_others (p_from, cmd, bcast, msg) {
	for (var i in players) {
		if (players[i].id != p_from.id) {
			send_cmd(players[i], cmd, null, true, msg, p_from);
		}
	}
}

function send_msg (p_from, p_to, msg) {
	send_cmd(p_to, 'msg', msg, true, msg, p_from);
}

function send_cmd (p_to, cmd, params, bcast, msg, p_from) {
	var data, raw;
	if (bcast === true) {
		data = {
			'cmd':cmd,
			'params':{
				'player_name':p_from.get_id(),
				'msg':msg
			}
		};              
	}
	else {
		data = {
			'cmd':cmd,
			'params':params
		};
	}		   
	raw = data = JSON.stringify(data);
	data = ws.wrap(tools.utf8.encode(data));
	p_to.write(data, 'binary');
	log('sent '+raw.length+' bytes : '+raw+' : to '+p_to.get_id());
}
