exports.handshake = function (p, data) { // receives player and handshake request
	log('player requested handshake...');
	var resource, headers, security_code;
	var ws_headers = get_ws_headers(data);
	if (ws_headers == null) {
		log('error handshaking: invalid header (key3)...');
		log('header received: \n'+data);
		return false;
	}
	resource = ws_headers[0];
	headers = ws_headers[1];
	security_code = ws_headers[2];
	
	log('handshaking with player id: '+p.get_id()+'...');
	
	var upgrade = '',
		security = '';
	
	var strkey1 = headers['Sec-WebSocket-Key1'],
		strkey2 = headers['Sec-WebSocket-Key2'],

		numkey1 = parseInt(strkey1.replace(/[^\d]/g, ''), 10),
		numkey2 = parseInt(strkey2.replace(/[^\d]/g, ''), 10),

		spaces1 = strkey1.match(/[\ ]/g),
		spaces2 = strkey2.match(/[\ ]/g);
		
		if (!spaces1)
			spaces1 = 0;
		else
			spaces1 = spaces1.length;

		if (!spaces2)
			spaces2 = 0;
		else
			spaces2 = spaces2.length;
		
	if (spaces1 == 0 || spaces2 == 0 ||
		 numkey1 % spaces1 != 0 || numkey2 % spaces2 != 0) {
		 log('error handshaking: couldn\'t interpret the sec-keys...');
		 log('header received: \n'+data);
		return false;
	} 
	else {
		var hash = crypto.createHash('md5'),
			key1 = tools.pack(parseInt(numkey1/spaces1)),
			key2 = tools.pack(parseInt(numkey2/spaces2));

		hash.update(key1);
		hash.update(key2);
		hash.update(security_code);

		security += hash.digest();
		
		// end of security response
		
		upgrade += 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n'+
			'Upgrade: WebSocket\r\n'+
			'Connection: Upgrade\r\n'+
			'Sec-WebSocket-Origin: ' + headers['Origin'] + '\r\n'+
			'Sec-WebSocket-Location: ws://'+headers['Host']+resource+'\r\n'+
			'\r\n'+
			security;
		p.write(upgrade, 'binary');
		p.hs = true;
		log('handshaked with player id: '+p.get_id());
		return true;
	}
}

function get_ws_headers (data) {
	var resource, headers, code;
	resource = data.match(/GET (.*?) HTTP/);
	code = data.match(/\r\n(.*?)$/);
	
	if (resource == null || code == null)
		return null;
	
	resource = resource[1];
	code = code[1];
		
	var headers = [];
	var lines = data.split('\r\n');
	var line_temp;
	for (var i in lines) {
		if (lines[i].indexOf(': ') != -1) {
		    line_temp = lines[i].split(': ');
		    headers[line_temp[0].trim()] = line_temp[1].trim();
		}
	}
	return [resource, headers, code];
}

exports.wrap = function (msg) {
	return '\x00'+msg+'\xff';
};

exports.unwrap = function (msg) {
	return msg.substring(1, (msg.length-1));
};
