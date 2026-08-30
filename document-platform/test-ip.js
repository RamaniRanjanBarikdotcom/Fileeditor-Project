const ipaddr = require('ipaddr.js');
console.log(ipaddr.parse('104.20.23.154').range());
console.log(ipaddr.parse('192.168.1.1').range());
console.log(ipaddr.parse('127.0.0.1').range());
