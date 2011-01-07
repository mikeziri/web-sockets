var host = null;
var socket = null;
var start_ping = null;
var msg_ = null;
var window_width = null;
var window_height = null;
var player_name = null;
var player_valid = false;
var port = null;

$(function () {
    disable_all();
    setup_interface();
    init();
});

function setup_interface () {
    window_width = $(window).width();
    window_height = $(window).height();
    
    $("#left").width(window_width/2);
    $("#left").height(window_height);
    
    $("#right").width(window_width/2);
    $("#right").height(window_height);
    
    $("#chat_text").width(window_width/2 - 150);
    $("#chat_text").height(window_height - 70); // $('#chat_input_div').height()
    $("#chat_input_div").width(window_width/2);
    
    $("#chat_text").scrollTo('100%', 0);
    
    var m = $('#modal'); // modal
    
    if (m) {
    	var w = m.outerWidth();
		var h = m.outerHeight();
		
		var x = (window_width/2) - (w/2);
		var y = (window_height/2) - (h/2);
		
		m.css('left', x).css('top', y);
		$('#modal_input').focus();
    }
    
    //$("#chat_users").height($("#chat_text").height() + chat_title_height);
}

function init() {
    $(window).resize(setup_interface); // on resise, adjust interface
    player_name_input();
    port = 8080;
    
    host = "ws://"+window.location.hostname+":"+port+window.location.pathname+"server/server.js";
    
    $("#connect").click(function () { connect(); });
    $("#disconnect").click(function () { disconnect(); });
    $("#send").click(function () { send_msg(); });
    $("#ping").click(function () { ping(); });
}

function player_name_input () {
    var mask = '<div id="mask"></div>';
    $(mask).appendTo(document.body);
    var modal = '<div id="modal">insert your player name<br />';
    modal += '<input type="text" name="" id="modal_input" /><br />';
    modal += '<button id="modal_submit">save</button>';
    modal += '</div>';
    var m = $(modal);
    m.appendTo(document.body);
    var input = $("#modal_input");
    
    var submit = $("#modal_submit");
    
    function setup_player (input) {
 		player_name = input.val().substring(0, 16);
		if (player_name.length == 0)
			return false;
		$("#mask").fadeOut();
		$("#modal").fadeOut();
		enable_element('connect');
		connect();
    }
    
	submit.click(function () {
        if (!setup_player(input))
        	input.focus();
    });
    
    m.keydown(function (evt) {
		if (evt.keyCode == 13) // enter key pressed
        	setup_player(input);
    });
    
    var w = m.outerWidth();
    var h = m.outerHeight();
    
    var x = (window_width/2) - (w/2);
    var y = (window_height/2) - (h/2);
    
    m.css('left', x).css('top', y).fadeIn();
    input.focus();
}

function disable_all () {
    $("button").attr('disabled', true);
    $("input").attr('disabled', true);
}

function enable_all () {
    $("button").attr('disabled', false);
    $("input").attr('disabled', false);
}

function disable_element (id) {
    $("#"+id).attr("disabled", true);
}

function enable_element (id) {
    $("#"+id).attr("disabled", false);
}

function on_window_resize() {
    setup_interface();
}

function on_open (msg) {
    console.log("connected and handshaked");
    send_cmd(make_json_cmd('setname', player_name));
}

function on_read (msg) {
    var d = msg.data;
    if (d[0] === '\0')
    	d = d.substring(1);
	console.log('received '+d.length+' bytes » ' + d);
    
    var d_obj = JSON.parse(d);
        
    switch (d_obj.cmd) {
    	case 'setname' : {
    		if (d_obj.params != 'ok') {
    			console.log(d_obj.params);
    			add_to_chat('server', 'player name already exists. refresh and change it');
    			disconnect();
    		}
    		else {
    			player_valid = true;
    			$(window).keydown(onkey);
    		}
    		break;
    	}
    	case 'pong' : {
    		pong(d_obj);
    		break;
    	}
    	case 'msg' : {
    		add_to_chat(d_obj.params.player_name, d_obj.params.msg, true);
    		break;
    	}
    	case 'connect' : {
    		add_to_chat(d_obj.params.player_name, 'connected', true);
    		break;
    	}
    	case 'disconnect' : {
    		add_to_chat(d_obj.params.player_name, 'disconnected', true);
    		break;
    	}
    	case 'error' : {
    		console.log('received an invalid command » ' + d_obj.params);
    		break;
    	}
    	default : {
    		console.log('received » cmd : ' + d_obj.cmd + ' params : ' + d_obj.params);
    	}
    }
}

function on_close (msg) {
    disconnect();
}

function write (data) {
    if (!socket) {
        console.log('not connected');
        return;
    }
    socket.send(data);
    console.log("sent » " + data);
}

function send_cmd (data) {
	if (!data) {
		console.log('invalid empty command');
	}
	data = JSON.stringify(data);
	write(data);
}

function send_msg () {
	if (!player_valid) {
		add_to_chat('serverd', 'player name already exists. refresh and change it');
		return;
	}
    var msg = $("#chat_input").val();
    if (msg.length == 0)
        return;
    send_cmd(make_json_cmd('msg', msg));
   	add_to_chat(player_name, msg);
   	   	
   	/*raw = data = JSON.stringify(data);
	data = ws.wrap(tools.utf8.encode(data));
	p_to.write(data, 'binary');
	log('sent '+raw.length+' bytes : '+raw+' : to '+p_to.name);*/
}

function add_to_chat(pn, msg, is_ext) {
	$('#chat_text').append('<b>'+pn+'</b>&nbsp;&nbsp;'+msg + '<br />')
	.scrollTo('100%', 0);
	if (!is_ext)
		$("#chat_input").val('').focus();
}

function make_json_cmd (cmd, params) {
	return {
		cmd:cmd,
		params: params
	};
	//return '{"cmd":"'+cmd+'","params":"'+params+'"}';
}

function onkey (evt) {
    if (evt.keyCode == 13) {
    	send_msg();
    }
}

function connect () {
    if (socket) {
        console.log('already connected');
        return;
    }
    try {
        socket = new WebSocket(host);
        console.log('connecting to ' + host + ' ...');
        socket.onopen = function (msg) { on_open(msg); };
        socket.onmessage = function (msg) { on_read(msg); };
        socket.onclose = function (msg) { on_close(msg); };
    }
    catch (e) {
        console.log(e);
    }
    enable_all();
    disable_element('connect');
}

function disconnect () {
    if (!socket)
        return;
    socket.close();
    console.log('disconnected');
    socket = null;
    disable_all();
    enable_element('connect');
	$(window).keydown(null);
}

function ping () {
	start_ping = new Date().getTime();
	//console.log('start_ping » ' + start_ping);
	send_cmd(make_json_cmd('ping', ''));
}

function pong (data) { //json object
	//console.log('pong params » ' + data.params);
    var end_ping = new Date().getTime();  
    var diff = end_ping - start_ping;
    console.log('ping » ' + diff + 'ms');
}
