exports.log = function (msg) {
	var d = new Date();
	console.log(d.toLocaleTimeString() + ' ' + msg);
};

String.prototype.trim = function () {
	var	str = this.replace(/^\s\s*/, ''),
		ws = /\s/,
		i = str.length;
	while (ws.test(str.charAt(--i)));
	return str.slice(0, i + 1);
};

exports.pack = function (num) {
	var result = '';
	result += String.fromCharCode(num >> 24 & 0xFF);
	result += String.fromCharCode(num >> 16 & 0xFF);
	result += String.fromCharCode(num >> 8 & 0xFF);
	result += String.fromCharCode(num &	0xFF);
	return result;
}

exports.utf8 = {
	encode: function (s) {
		for(var c, i = -1, l = (s = s.split("")).length, o = String.fromCharCode; ++i < l;
			s[i] = (c = s[i].charCodeAt(0)) >= 127 ? o(0xc0 | (c >>> 6)) + o(0x80 | (c & 0x3f)) : s[i]
		);
		return s.join("");
	},
	decode: function (s) {
		for(var a, b, i = -1, l = (s = s.split("")).length, o = String.fromCharCode, c = "charCodeAt"; ++i < l;
			((a = s[i][c](0)) & 0x80) &&
			(s[i] = (a & 0xfc) == 0xc0 && ((b = s[i + 1][c](0)) & 0xc0) == 0x80 ?
			o(((a & 0x03) << 6) + (b & 0x3f)) : o(128), s[++i] = "")
		);
		return s.join("");
	}
};
