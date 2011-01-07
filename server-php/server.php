#!/php -q
<?php  /*  » php -q server.php  */

error_reporting(E_ALL);
set_time_limit(0);
ob_implicit_flush();


$p_id = 0;

class Player{
  var $id = null;
  var $name = "";
  var $s = null;
  var $hs = false;
}

$ss = web_socket(8080); // server socket
$socks = array($ss); // all sockets
$ps = array(); // all players
$debug = true;

while (true) {
	$changed = $socks;
	socket_select($changed, $write = NULL, $except = NULL, NULL); // waits (blocks) for incoming messages
	foreach ($changed as $s) {
		if($s == $ss){ // if the server socket received something » new connection
			if (($cl = socket_accept($ss)) < 0) { // new cl(ient)
				console("socket_accept() failed"); 
				continue; 
			}
			else {
				connect_player($cl); // add new socket and player
			}
		}
		else { // new message from existing player
			if (($r = @socket_recv($s, $data, 1024, 0)) == 0) {
				disconnect_player($s); // 0 bytes received » player disconnected
			}
			else { // deal with data read
				$p = get_player_by_socket($s);
				if (!$p->hs) { // if didn't handshake (websockets)
					handshake($p, $data);
				}
				else {
					process_data($p, $data);
				}
			}
		}
	}
}

function console ($msg, $sd = true) { // sd » show date
	if ($sd)
		echo date("h:m:s") . " $msg\n";
	else
		echo "$msg\n";
}

function web_socket ($port) {
	$s = socket_create(AF_INET, SOCK_STREAM, SOL_TCP) or die("socket_create() failed");
	socket_set_option($s, SOL_SOCKET, SO_REUSEADDR, 1) or die("socket_option() failed");
	socket_bind($s, 0, $port) or die("socket_bind() failed");
	socket_listen($s, 20) or die("socket_listen() failed"); // 20 » max connections

	console("server started : ".date('Y-m-d H:i:s'));
	console("server socket : $s");
	console("server listening on port : $port");
	console("----------------------------------------\n", false);
	return $s;
}

function connect_player ($s) { // receives new player's s(ocket)
	global $socks, $ps, $p_ids; // all sockets, all players, player's ids
	console("new player connecting... : $s");
	$p = new Player();
	$p->id = $p_ids++;
	$p->s = $s;
	array_push($ps, $p);
	array_push($socks, $s);
	console("player connected : ".$s);
}

function disconnect_player ($s) { // receives player's s(ocket)
	global $socks, $ps;
	$p = null;
	$found = null;
	$n = count($ps);
	for ($i = 0; $i < $n; $i++) {
		if($ps[$i]->s == $s) {
			$found = $i; break; 
		}
	}
	if (!is_null($found)) {
		$p = $ps[$found];
		array_splice($ps, $found, 1);
	}
	$index = array_search($s, $socks);
	socket_close($s);
	console("player disconnected : ".$p->name);
	if ($index >= 0) {
		array_splice($socks, $index, 1);
	}
	send_cmd_others($p, 'disconnect', true, '');
}

function get_player_by_socket ($s) { // receives player's s(ocket)
	global $ps;
	$n = count($ps);
	for ($i = 0; $i < $n; $i++) {
		if ($ps[$i]->s == $s) {
			return $ps[$i];
		}
	}
	return null;
}

function get_ws_headers ($req) {
	$resource = $code = null;
	preg_match('/GET (.*?) HTTP/', $req, $match) && $resource = $match[1];
	preg_match("/\r\n(.*?)\$/", $req, $match) && $code = $match[1];
	$headers = array();
	foreach(explode("\r\n", $req) as $line) {
		if (strpos($line, ': ') !== false) {
		    list($key, $value) = explode(': ', $line);
		    $headers[trim($key)] = trim($value);
		}
	}
	return array($resource, $headers, $code);
}

function handle_security_key($key) {
	preg_match_all('/[0-9]/', $key, $number);
	preg_match_all('/ /', $key, $space);
	if ($number && $space) {
		return implode('', $number[0]) / count($space[0]);
	}
	return '';
}

function get_handshake_security_key($key1, $key2, $code) {
	return md5(
		pack('N', handle_security_key($key1)).
		pack('N', handle_security_key($key2)).
		$code,
		true
	);
}

function handshake ($p, $req) { // receives player and handshake request
	console("player requesting handshake...");
	//console($data);
	//$resrc, $host, $origin, $strkey1, $strkey2, $data
	list($resource, $headers, $securityCode) = get_ws_headers($req);
	console("handshaking...");
	
	$securityResponse = '';
	if (isset($headers['Sec-WebSocket-Key1']) && isset($headers['Sec-WebSocket-Key2'])) {
		$securityResponse = get_handshake_security_key($headers['Sec-WebSocket-Key1'], $headers['Sec-WebSocket-Key2'], $securityCode);
	}

	if ($securityResponse) {
		$upgrade  = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" .
		    "Upgrade: WebSocket\r\n" .
		    "Connection: Upgrade\r\n" .
		    "Sec-WebSocket-Origin: " . $headers['Origin'] . "\r\n" .
		    "Sec-WebSocket-Location: ws://" . $headers['Host'] . $resource . "\r\n" .
		    "\r\n".$securityResponse;        
	} 
	else {
		$upgrade  = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" .
		    "Upgrade: WebSocket\r\n" .
		    "Connection: Upgrade\r\n" .
		    "WebSocket-Origin: " . $headers['Origin'] . "\r\n" .
		    "WebSocket-Location: ws://" . $headers['Host'] . $resource . "\r\n" .
		    "\r\n";        
	}

	socket_write($p->s, $upgrade.chr(0), strlen($upgrade.chr(0)));

	$p->hs = true;
	console("handshaked with player : ".$p->s);
	return true;
}

function process_data ($p, $msg) { // receives player and data
	$msg = unwrap($msg);
	$data = json_decode($msg, true);
	$id = ($p->name) ? $p->name : $p->s;
	console("received ".strlen($msg)." bytes : " . $msg . " from : $id");
	
	switch ($data['cmd']) {
		case 'setname' : {
			$p->name = $data['params'];
			send_cmd($p, 'setname', 'ok');
			break;
		}
		case 'ping' : {
			send_cmd($p, 'pong', '');
			break;
		}
		case 'msg' : {
			send_cmd_others ($p, 'msg', true, $data['params']);
			break;
		}
		default : {
			console('received invalid command '.$data['params']);
			send_cmd($p, 'error', $data['params']);
		}
	}
}

function send_cmd_others ($p_from, $cmd, $bcast = false, $msg = null) {
	global $ps;
	foreach ($ps as $pl) {
		if ($pl->s != $p_from->s) {
			send_cmd($pl, $cmd, null, true, $msg, $p_from);
		}
	}
}

function send_msg ($p_from, $p_to, $msg) {
	send_cmd($p_to, 'msg', $msg, true, $msg, $p_from);
}

function send_cmd ($p_to, $cmd, $params, $bcast = false, $msg = null, $p_from = null) {
	if ($bcast) {
		$data = array('cmd' => $cmd, 'params' => 
			array('player_name' => $p_from->name, 'msg' => $msg));
	}
	else
		$data = array('cmd' => $cmd, 'params' => $params);

	$data_temp = json_encode($data);
	$data = wrap($data_temp);
	$w = socket_write($p_to->s, $data, strlen($data));
	console('sent '.$w.' bytes : ' . $data_temp . ' : to ' . $p_to->name);
}

function wrap($msg=""){ return chr(0).$msg.chr(255); }
function unwrap($msg=""){ return substr($msg,1,strlen($msg)-2); }

?>
