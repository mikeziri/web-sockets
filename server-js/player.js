var player = require('net').Stream;

exports.player;

player.prototype.id = null;
player.prototype.name = null;
player.prototype.hs = false; // handshake
player.prototype.ptoString = function () {
	return ('Player ' + this.id + ' » name: ' + this.name);
};
player.prototype.get_id = function (real_id) {
	return (real_id === true) ? this.id : (this.name ? this.name : this.id);
}
