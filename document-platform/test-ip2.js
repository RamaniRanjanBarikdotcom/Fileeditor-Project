const ipaddr = require('./packages/url-security/node_modules/ipaddr.js');
try {
    const ip = ipaddr.parse('104.20.23.154');
    console.log(ip.range());
} catch(e) {
    console.log("Error:", e);
}
